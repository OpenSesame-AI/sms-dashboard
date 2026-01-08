import { db, postgresClient } from './index'
import { phoneUserMappings, smsConversations, aiAnalysisColumns, aiAnalysisResults, cells, cellContext, contactSeenState, aiAlerts, aiAlertTriggers, columnColors, columnVisibility, availablePhoneNumbers, integrations, salesforceContacts, apiKeys } from './schema'
import { eq, sql, desc, asc, and, gte, or, like, isNull } from 'drizzle-orm'
import { normalizePhoneNumber, getCellCountry } from '@/lib/utils'
import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto'

export type Contact = {
  id: string
  phoneNumber: string
  userId: string
  lastMessage: string | null
  status: string | null
  numberOfMessages: number
  started: string | null
  lastActivity: string | null
  lastMessageDirection: 'inbound' | 'outbound' | null
  lastSeenActivity: string | null
  salesforceId?: string
  firstName?: string
  lastName?: string
  email?: string
  accountId?: string
  accountName?: string
}

// Helper functions to format dates as strings
// Handle both Date objects and date strings from postgres
const formatDate = (date: Date | string | null | undefined): string | null => {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return null
  return d.toISOString().split('T')[0] // YYYY-MM-DD format
}

const formatDateTime = (date: Date | string | null | undefined): string | null => {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return null
  const dateStr = d.toISOString().split('T')[0]
  const timeStr = d.toTimeString().split(' ')[0].slice(0, 5) // HH:MM format
  return `${dateStr} ${timeStr}`
}

export async function getContacts(cellId?: string): Promise<Contact[]> {
  // Optimized query using window functions instead of correlated subqueries
  // This is much faster than correlated subqueries which run for each row
  
  // Get cell country for normalization if cellId is provided
  let cellCountry: string | null = null
  if (cellId) {
    const cell = await db
      .select({ phoneNumber: cells.phoneNumber })
      .from(cells)
      .where(eq(cells.id, cellId))
      .limit(1)
    if (cell[0]?.phoneNumber) {
      cellCountry = getCellCountry(cell[0].phoneNumber)
    }
  }
  
  // First, get all seen states for this cell
  const seenStates = await getAllContactSeenStates(cellId)
  const seenStateMap = new Map<string, string>()
  seenStates.forEach((state) => {
    if (state.lastSeenActivity) {
      // Normalize phone number for seen state lookup
      const normalized = normalizePhoneNumber(state.phoneNumber, cellCountry || undefined) || state.phoneNumber
      const existing = seenStateMap.get(normalized)
      // Keep the most recent seen activity
      if (!existing || new Date(state.lastSeenActivity) > new Date(existing)) {
        seenStateMap.set(normalized, state.lastSeenActivity.toISOString())
      }
    }
  })
  
  // Use postgres client directly for raw SQL queries with window functions
  // This uses DISTINCT ON and window functions to get the latest message per phone number
  // which is much faster than correlated subqueries
  const results = cellId
    ? await postgresClient`
        WITH latest_messages AS (
          SELECT DISTINCT ON (s.phone_number)
            s.phone_number,
            s.status as "lastStatus",
            s.direction as "lastMessageDirection",
            s.message_body as "lastMessage",
            s.timestamp as "lastActivity"
          FROM sms_conversations s
          WHERE s.cell_id = ${cellId}
          ORDER BY s.phone_number, s.timestamp DESC
        ),
        message_counts AS (
          SELECT 
            s.phone_number,
            COUNT(*)::int as "numberOfMessages"
          FROM sms_conversations s
          WHERE s.cell_id = ${cellId}
          GROUP BY s.phone_number
        )
        SELECT 
          p.id,
          p.phone_number as "phoneNumber",
          p.user_id as "userId",
          p.created_at as "createdAt",
          COALESCE(mc."numberOfMessages", 0) as "numberOfMessages",
          lm."lastMessage",
          lm."lastActivity",
          lm."lastStatus",
          lm."lastMessageDirection",
          sf."salesforce_id" as "salesforceId",
          sf."first_name" as "firstName",
          sf."last_name" as "lastName",
          sf."email" as "email",
          sf."account_id" as "accountId",
          sf."account_name" as "accountName"
        FROM phone_user_mappings p
        LEFT JOIN latest_messages lm ON lm.phone_number = p.phone_number
        LEFT JOIN message_counts mc ON mc.phone_number = p.phone_number
        LEFT JOIN salesforce_contacts sf ON sf.phone_number = p.phone_number AND sf.cell_id = p.cell_id
        WHERE p.cell_id = ${cellId}
        ORDER BY lm."lastActivity" DESC NULLS LAST
      `
    : await postgresClient`
        WITH latest_messages AS (
          SELECT DISTINCT ON (s.phone_number)
            s.phone_number,
            s.status as "lastStatus",
            s.direction as "lastMessageDirection",
            s.message_body as "lastMessage",
            s.timestamp as "lastActivity"
          FROM sms_conversations s
          ORDER BY s.phone_number, s.timestamp DESC
        ),
        message_counts AS (
          SELECT 
            s.phone_number,
            COUNT(*)::int as "numberOfMessages"
          FROM sms_conversations s
          GROUP BY s.phone_number
        )
        SELECT 
          p.id,
          p.phone_number as "phoneNumber",
          p.user_id as "userId",
          p.created_at as "createdAt",
          COALESCE(mc."numberOfMessages", 0) as "numberOfMessages",
          lm."lastMessage",
          lm."lastActivity",
          lm."lastStatus",
          lm."lastMessageDirection",
          sf."salesforce_id" as "salesforceId",
          sf."first_name" as "firstName",
          sf."last_name" as "lastName",
          sf."email" as "email",
          sf."account_id" as "accountId",
          sf."account_name" as "accountName"
        FROM phone_user_mappings p
        LEFT JOIN latest_messages lm ON lm.phone_number = p.phone_number
        LEFT JOIN message_counts mc ON mc.phone_number = p.phone_number
        LEFT JOIN salesforce_contacts sf ON sf.phone_number = p.phone_number AND sf.cell_id = p.cell_id
        ORDER BY lm."lastActivity" DESC NULLS LAST
      `

  // Ensure results is an array
  if (!Array.isArray(results)) {
    console.error('[getContacts] Results is not an array:', typeof results, results)
    return []
  }

  // Group contacts by normalized phone number to merge duplicates
  const contactsByNormalized = new Map<string, Contact>()
  
  for (const row of results) {
    try {
      // Normalize phone number to merge duplicates
      const normalizedPhone = normalizePhoneNumber(row.phoneNumber, cellCountry || undefined) || row.phoneNumber
      const existing = contactsByNormalized.get(normalizedPhone)
      
      const direction = row.lastMessageDirection?.toLowerCase()
      const lastSeenActivityRaw = seenStateMap.get(normalizedPhone) || null
      const lastSeenActivity = lastSeenActivityRaw ? formatDateTime(lastSeenActivityRaw) : null
      
      const contact: Contact = {
        id: row.id,
        phoneNumber: normalizedPhone, // Use normalized phone number
        userId: row.userId,
        lastMessage: row.lastMessage || null,
        status: row.lastStatus || 'pending',
        numberOfMessages: row.numberOfMessages || 0,
        started: formatDate(row.createdAt),
        lastActivity: formatDateTime(row.lastActivity),
        lastMessageDirection: direction === 'inbound' || direction === 'outbound' ? direction : null,
        lastSeenActivity,
        salesforceId: row.salesforceId || undefined,
        firstName: row.firstName || undefined,
        lastName: row.lastName || undefined,
        email: row.email || undefined,
        accountId: row.accountId || undefined,
        accountName: row.accountName || undefined,
      }
      
      if (existing) {
        // Merge with existing contact - keep the most recent data
        // Use the most recent activity
        const existingActivity = existing.lastActivity ? new Date(existing.lastActivity) : null
        const newActivity = contact.lastActivity ? new Date(contact.lastActivity) : null
        if (newActivity && (!existingActivity || newActivity > existingActivity)) {
          existing.lastActivity = contact.lastActivity
          existing.lastMessage = contact.lastMessage
          existing.status = contact.status
          existing.lastMessageDirection = contact.lastMessageDirection
        }
        // Sum message counts (though they should be the same if normalized correctly)
        existing.numberOfMessages = Math.max(existing.numberOfMessages, contact.numberOfMessages)
        // Use earliest start date
        const existingStarted = existing.started ? new Date(existing.started) : null
        const newStarted = contact.started ? new Date(contact.started) : null
        if (newStarted && (!existingStarted || newStarted < existingStarted)) {
          existing.started = contact.started
        }
      } else {
        contactsByNormalized.set(normalizedPhone, contact)
      }
    } catch (err) {
      console.error('[getContacts] Error mapping row:', err, row)
      throw err
    }
  }

  return Array.from(contactsByNormalized.values())
}

export async function getContactById(id: string): Promise<Contact | null> {
  const mapping = await db
    .select()
    .from(phoneUserMappings)
    .where(eq(phoneUserMappings.id, id))
    .limit(1)

  if (mapping.length === 0) {
    return null
  }

  const phoneMapping = mapping[0]

  const conversationStats = await db
    .select({
      count: sql<number>`count(*)::int`,
      lastMessage: sql<string | null>`max(${smsConversations.messageBody})`,
      lastActivity: sql<Date | null>`max(${smsConversations.timestamp})`,
      lastStatus: sql<string | null>`(
        SELECT ${smsConversations.status} 
        FROM ${smsConversations} 
        WHERE ${smsConversations.phoneNumber} = ${phoneMapping.phoneNumber}
        ORDER BY ${smsConversations.timestamp} DESC 
        LIMIT 1
      )`,
      lastMessageDirection: sql<string | null>`(
        SELECT ${smsConversations.direction} 
        FROM ${smsConversations} 
        WHERE ${smsConversations.phoneNumber} = ${phoneMapping.phoneNumber}
        ORDER BY ${smsConversations.timestamp} DESC 
        LIMIT 1
      )`,
    })
    .from(smsConversations)
    .where(eq(smsConversations.phoneNumber, phoneMapping.phoneNumber))

  const stats = conversationStats[0]
  const direction = stats?.lastMessageDirection?.toLowerCase()

  // Get seen state for this contact
  const seenState = await getContactSeenState(phoneMapping.phoneNumber, phoneMapping.cellId || undefined)
  const lastSeenActivityRaw = seenState?.lastSeenActivity?.toISOString() || null
  const lastSeenActivity = lastSeenActivityRaw ? formatDateTime(lastSeenActivityRaw) : null

  return {
    id: phoneMapping.id,
    phoneNumber: phoneMapping.phoneNumber,
    userId: phoneMapping.userId,
    lastMessage: stats?.lastMessage || null,
    status: stats?.lastStatus || 'pending',
    numberOfMessages: stats?.count || 0,
    started: formatDate(phoneMapping.createdAt),
    lastActivity: formatDateTime(stats?.lastActivity),
    lastMessageDirection: direction === 'inbound' || direction === 'outbound' ? direction : null,
    lastSeenActivity,
  }
}

export type ConversationMessage = {
  id: string
  text: string
  timestamp: string
  isInbound: boolean
}

export async function getConversationsByPhoneNumber(
  phoneNumber: string,
  cellId?: string
): Promise<ConversationMessage[]> {
  const conditions = [eq(smsConversations.phoneNumber, phoneNumber)]
  
  if (cellId) {
    // Include messages for this cellId OR messages without a cellId (for backward compatibility)
    conditions.push(
      or(
        eq(smsConversations.cellId, cellId),
        sql`${smsConversations.cellId} IS NULL`
      ) as any
    )
  }
  
  const conversations = await db
    .select()
    .from(smsConversations)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .orderBy(asc(smsConversations.timestamp))

  return conversations.map((conv) => ({
    id: conv.id,
    text: conv.messageBody,
    timestamp: conv.timestamp
      ? new Date(conv.timestamp).toLocaleString()
      : new Date().toLocaleString(),
    isInbound: conv.direction.toLowerCase() === 'inbound',
  }))
}

// Analytics query functions
export type AnalyticsSummary = {
  totalMessages: number
  totalContacts: number
  inboundCount: number
  outboundCount: number
  deliveryRate: number
}

export async function getAnalyticsSummary(cellId?: string): Promise<AnalyticsSummary> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const messageConditions = cellId ? [eq(smsConversations.cellId, cellId)] : []
  const contactConditions = cellId ? [eq(phoneUserMappings.cellId, cellId)] : []

  // Get total messages
  const totalMessagesResult = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .where(messageConditions.length > 0 ? and(...messageConditions) : undefined)

  // Get total contacts
  const totalContactsResult = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(phoneUserMappings)
    .where(contactConditions.length > 0 ? and(...contactConditions) : undefined)

  // Get inbound/outbound counts
  const directionStats = await db
    .select({
      direction: smsConversations.direction,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .where(messageConditions.length > 0 ? and(...messageConditions) : undefined)
    .groupBy(smsConversations.direction)

  // Get status breakdown for delivery rate
  const statusStats = await db
    .select({
      status: smsConversations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .where(messageConditions.length > 0 ? and(...messageConditions) : undefined)
    .groupBy(smsConversations.status)

  const inboundCount =
    directionStats.find((s) => s.direction?.toLowerCase() === 'inbound')?.count || 0
  const outboundCount =
    directionStats.find((s) => s.direction?.toLowerCase() === 'outbound')?.count || 0

  const deliveredCount =
    statusStats.find((s) => s.status?.toLowerCase() === 'delivered')?.count || 0
  const totalWithStatus = statusStats.reduce((sum, s) => sum + (s.count || 0), 0)
  const deliveryRate =
    totalWithStatus > 0 ? (deliveredCount / totalWithStatus) * 100 : 0

  return {
    totalMessages: totalMessagesResult[0]?.count || 0,
    totalContacts: totalContactsResult[0]?.count || 0,
    inboundCount,
    outboundCount,
    deliveryRate: Math.round(deliveryRate * 100) / 100,
  }
}

export type MessagesOverTime = {
  date: string
  count: number
}

export async function getMessagesOverTime(cellId?: string): Promise<MessagesOverTime[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const conditions = [gte(smsConversations.timestamp, thirtyDaysAgo)]
  if (cellId) {
    conditions.push(eq(smsConversations.cellId, cellId))
  }

  const results = await db
    .select({
      date: sql<string>`to_char(${smsConversations.timestamp}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .where(and(...conditions))
    .groupBy(sql`to_char(${smsConversations.timestamp}, 'YYYY-MM-DD')`)
    .orderBy(asc(sql`to_char(${smsConversations.timestamp}, 'YYYY-MM-DD')`))

  return results.map((r) => ({
    date: r.date,
    count: r.count,
  }))
}

export type MessagesByDirection = {
  date: string
  inbound: number
  outbound: number
}

export async function getMessagesByDirection(cellId?: string): Promise<MessagesByDirection[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const conditions = [gte(smsConversations.timestamp, thirtyDaysAgo)]
  if (cellId) {
    conditions.push(eq(smsConversations.cellId, cellId))
  }

  const results = await db
    .select({
      date: sql<string>`to_char(${smsConversations.timestamp}, 'YYYY-MM-DD')`,
      direction: smsConversations.direction,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .where(and(...conditions))
    .groupBy(
      sql`to_char(${smsConversations.timestamp}, 'YYYY-MM-DD')`,
      smsConversations.direction
    )
    .orderBy(asc(sql`to_char(${smsConversations.timestamp}, 'YYYY-MM-DD')`))

  // Group by date and separate inbound/outbound
  const grouped = new Map<string, { inbound: number; outbound: number }>()

  results.forEach((r) => {
    const date = r.date
    if (!grouped.has(date)) {
      grouped.set(date, { inbound: 0, outbound: 0 })
    }
    const entry = grouped.get(date)!
    if (r.direction?.toLowerCase() === 'inbound') {
      entry.inbound = r.count
    } else {
      entry.outbound = r.count
    }
  })

  return Array.from(grouped.entries())
    .map(([date, counts]) => ({
      date,
      inbound: counts.inbound,
      outbound: counts.outbound,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export type StatusBreakdown = {
  status: string
  count: number
}

export async function getStatusBreakdown(cellId?: string): Promise<StatusBreakdown[]> {
  const conditions = cellId ? [eq(smsConversations.cellId, cellId)] : []

  const results = await db
    .select({
      status: smsConversations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(smsConversations.status)
    .orderBy(desc(sql`count(*)`))

  return results
    .map((r) => ({
      status: r.status || 'unknown',
      count: r.count,
    }))
    .filter((r) => r.status !== null)
}

export type TopActiveContact = {
  phoneNumber: string
  messageCount: number
  userId: string
}

export async function getTopActiveContacts(limit: number = 10, cellId?: string): Promise<TopActiveContact[]> {
  const conditions = cellId ? [eq(smsConversations.cellId, cellId)] : []

  const results = await db
    .select({
      phoneNumber: smsConversations.phoneNumber,
      userId: smsConversations.userId,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(smsConversations.phoneNumber, smsConversations.userId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)

  return results.map((r) => ({
    phoneNumber: r.phoneNumber,
    messageCount: r.count,
    userId: r.userId,
  }))
}

export type NewContactsOverTime = {
  date: string
  count: number
}

export async function getNewContactsOverTime(cellId?: string): Promise<NewContactsOverTime[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const conditions = [gte(phoneUserMappings.createdAt, thirtyDaysAgo)]
  if (cellId) {
    conditions.push(eq(phoneUserMappings.cellId, cellId))
  }

  const results = await db
    .select({
      date: sql<string>`to_char(${phoneUserMappings.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(phoneUserMappings)
    .where(and(...conditions))
    .groupBy(sql`to_char(${phoneUserMappings.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(asc(sql`to_char(${phoneUserMappings.createdAt}, 'YYYY-MM-DD')`))

  return results.map((r) => ({
    date: r.date,
    count: r.count,
  }))
}

export type HourlyDistribution = {
  hour: number
  count: number
}

export async function getHourlyDistribution(cellId?: string): Promise<HourlyDistribution[]> {
  const conditions = cellId ? [eq(smsConversations.cellId, cellId)] : []

  const results = await db
    .select({
      hour: sql<number>`extract(hour from ${smsConversations.timestamp})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(sql`extract(hour from ${smsConversations.timestamp})`)
    .orderBy(asc(sql`extract(hour from ${smsConversations.timestamp})`))

  // Fill in missing hours with 0
  const hourlyMap = new Map<number, number>()
  results.forEach((r) => {
    hourlyMap.set(r.hour, r.count)
  })

  const allHours = Array.from({ length: 24 }, (_, i) => i)
  return allHours.map((hour) => ({
    hour,
    count: hourlyMap.get(hour) || 0,
  }))
}

// AI Analysis Columns queries
export async function getAiColumns() {
  return await db.select().from(aiAnalysisColumns).orderBy(asc(aiAnalysisColumns.createdAt))
}

export async function getAiColumnByKey(columnKey: string) {
  const result = await db
    .select()
    .from(aiAnalysisColumns)
    .where(eq(aiAnalysisColumns.columnKey, columnKey))
    .limit(1)
  
  return result[0] || null
}

export async function createAiColumn(columnKey: string, name: string, prompt: string) {
  const result = await db
    .insert(aiAnalysisColumns)
    .values({
      columnKey,
      name,
      prompt,
    })
    .returning()
  
  return result[0]
}

export async function updateAiColumn(columnKey: string, name: string, prompt: string) {
  const result = await db
    .update(aiAnalysisColumns)
    .set({
      name,
      prompt,
      updatedAt: new Date(),
    })
    .where(eq(aiAnalysisColumns.columnKey, columnKey))
    .returning()
  
  return result[0] || null
}

export async function deleteAiColumn(columnKey: string) {
  // Delete results first (cascade)
  await db
    .delete(aiAnalysisResults)
    .where(eq(aiAnalysisResults.columnKey, columnKey))
  
  // Then delete the column
  await db
    .delete(aiAnalysisColumns)
    .where(eq(aiAnalysisColumns.columnKey, columnKey))
}

// AI Analysis Results queries
export async function getAiResults(columnKey: string) {
  return await db
    .select()
    .from(aiAnalysisResults)
    .where(eq(aiAnalysisResults.columnKey, columnKey))
}

export async function getAiResult(columnKey: string, phoneNumber: string) {
  const result = await db
    .select()
    .from(aiAnalysisResults)
    .where(
      and(
        eq(aiAnalysisResults.columnKey, columnKey),
        eq(aiAnalysisResults.phoneNumber, phoneNumber)
      )
    )
    .limit(1)
  
  return result[0] || null
}

export async function saveAiResults(
  columnKey: string,
  results: Array<{ phoneNumber: string; result: string | null }>
) {
  // Upsert: update existing or insert new results
  for (const { phoneNumber, result } of results) {
    const existing = await getAiResult(columnKey, phoneNumber)
    
    if (existing) {
      // Update existing result
      await db
        .update(aiAnalysisResults)
        .set({
          result,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiAnalysisResults.columnKey, columnKey),
            eq(aiAnalysisResults.phoneNumber, phoneNumber)
          )
        )
    } else {
      // Insert new result
      await db
        .insert(aiAnalysisResults)
        .values({
          columnKey,
          phoneNumber,
          result,
        })
    }
  }
}

// Cell CRUD queries
export async function getAllCells(userId: string, orgId?: string | null) {
  if (orgId) {
    // Organization mode: get org cells
    return await db
      .select()
      .from(cells)
      .where(eq(cells.organizationId, orgId))
      .orderBy(asc(cells.createdAt))
  } else {
    // Personal mode: get user's personal cells (no org)
    return await db
      .select()
      .from(cells)
      .where(and(
        eq(cells.userId, userId),
        isNull(cells.organizationId)
      ))
      .orderBy(asc(cells.createdAt))
  }
}

export async function getCellById(id: string, userId?: string, orgId?: string | null) {
  const conditions = [eq(cells.id, id)]
  
  if (orgId) {
    // Organization mode: verify cell belongs to org
    conditions.push(eq(cells.organizationId, orgId))
  } else if (userId) {
    // Personal mode: verify cell belongs to user and is personal
    conditions.push(eq(cells.userId, userId))
    conditions.push(isNull(cells.organizationId))
  }
  
  const result = await db
    .select()
    .from(cells)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .limit(1)
  
  return result[0] || null
}


import { DEFAULT_SYSTEM_PROMPT } from "@/lib/constants"

export async function createCell(phoneNumber: string, name: string, userId: string, systemPrompt?: string, organizationId?: string | null) {
  const result = await db
    .insert(cells)
    .values({
      phoneNumber,
      name,
      userId,
      organizationId: organizationId || null,
      systemPrompt: systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
    })
    .returning()
  
  return result[0]
}

export async function updateCell(id: string, name: string, userId: string, phoneNumber?: string, systemPrompt?: string, orgId?: string | null) {
  const updateData: { name: string; phoneNumber?: string; systemPrompt?: string; updatedAt: Date } = {
    name,
    updatedAt: new Date(),
  }
  
  if (phoneNumber) {
    updateData.phoneNumber = phoneNumber
  }
  
  if (systemPrompt !== undefined) {
    updateData.systemPrompt = systemPrompt
  }
  
  // Build where condition based on context
  const whereConditions = [eq(cells.id, id)]
  if (orgId) {
    // Organization mode: verify cell belongs to org
    whereConditions.push(eq(cells.organizationId, orgId))
  } else {
    // Personal mode: verify cell belongs to user and is personal
    whereConditions.push(eq(cells.userId, userId))
    whereConditions.push(isNull(cells.organizationId))
  }
  
  const result = await db
    .update(cells)
    .set(updateData)
    .where(and(...whereConditions))
    .returning()
  
  return result[0] || null
}

export async function deleteCell(id: string, userId: string, orgId?: string | null) {
  // Build where condition based on context
  const whereConditions = [eq(cells.id, id)]
  if (orgId) {
    // Organization mode: verify cell belongs to org
    whereConditions.push(eq(cells.organizationId, orgId))
  } else {
    // Personal mode: verify cell belongs to user and is personal
    whereConditions.push(eq(cells.userId, userId))
    whereConditions.push(isNull(cells.organizationId))
  }
  
  // Get the cell's phone number before deleting
  const cell = await db
    .select({ phoneNumber: cells.phoneNumber })
    .from(cells)
    .where(and(...whereConditions))
    .limit(1)

  if (cell.length === 0) {
    throw new Error('Cell not found or access denied')
  }

  // Delete the cell
  await db
    .delete(cells)
    .where(and(...whereConditions))

  // If cell was found and deleted, add phone number to available numbers
  // Wrap in try-catch to prevent deletion failure if table doesn't exist yet
  if (cell[0].phoneNumber) {
    try {
      await db
        .insert(availablePhoneNumbers)
        .values({ phoneNumber: cell[0].phoneNumber })
        .onConflictDoNothing() // Ignore if already exists
    } catch (error) {
      // Log but don't fail deletion if adding to available numbers fails
      // This can happen if the migration hasn't been run yet
      console.warn(`Failed to add phone number ${cell[0].phoneNumber} to available numbers:`, error)
    }
  }
}

// Available Phone Numbers queries
export async function getAvailablePhoneNumber(): Promise<string | null> {
  const result = await db
    .select({ phoneNumber: availablePhoneNumbers.phoneNumber })
    .from(availablePhoneNumbers)
    .orderBy(asc(availablePhoneNumbers.createdAt))
    .limit(1)

  return result.length > 0 ? result[0].phoneNumber : null
}

export async function removeAvailablePhoneNumber(phoneNumber: string) {
  await db
    .delete(availablePhoneNumbers)
    .where(eq(availablePhoneNumbers.phoneNumber, phoneNumber))
}

export async function addAvailablePhoneNumber(phoneNumber: string) {
  try {
    await db
      .insert(availablePhoneNumbers)
      .values({ phoneNumber })
      .onConflictDoNothing() // Ignore if already exists
  } catch (error) {
    console.warn(`Failed to add phone number ${phoneNumber} to available numbers:`, error)
    throw error
  }
}

// Cell Context CRUD queries
export async function getCellContext(cellId: string) {
  return await db
    .select()
    .from(cellContext)
    .where(eq(cellContext.cellId, cellId))
    .orderBy(asc(cellContext.createdAt))
}

export async function addCellContext(
  cellId: string,
  type: 'text' | 'file',
  name: string,
  content: string | null,
  mimeType?: string | null,
  fileSize?: number | null
) {
  const result = await db
    .insert(cellContext)
    .values({
      cellId,
      type,
      name,
      content,
      mimeType: mimeType || null,
      fileSize: fileSize || null,
    })
    .returning()
  
  return result[0]
}

export async function deleteCellContext(contextId: string) {
  await db
    .delete(cellContext)
    .where(eq(cellContext.id, contextId))
}

// Contact Seen State queries
export async function getContactSeenState(phoneNumber: string, cellId?: string) {
  const result = await db
    .select()
    .from(contactSeenState)
    .where(
      cellId
        ? and(
            eq(contactSeenState.phoneNumber, phoneNumber),
            eq(contactSeenState.cellId, cellId)
          )
        : eq(contactSeenState.phoneNumber, phoneNumber)
    )
    .limit(1)
  
  return result[0] || null
}

export async function getAllContactSeenStates(cellId?: string) {
  const results = await db
    .select()
    .from(contactSeenState)
    .where(cellId ? eq(contactSeenState.cellId, cellId) : undefined)
  
  return results
}

export async function markContactAsSeen(phoneNumber: string, lastSeenActivity: string, cellId?: string) {
  // Try to find existing record
  const existing = await getContactSeenState(phoneNumber, cellId)
  
  if (existing) {
    // Update existing record
    const result = await db
      .update(contactSeenState)
      .set({
        lastSeenActivity: new Date(lastSeenActivity),
        updatedAt: new Date(),
      })
      .where(eq(contactSeenState.id, existing.id))
      .returning()
    
    return result[0] || null
  } else {
    // Insert new record
    const result = await db
      .insert(contactSeenState)
      .values({
        phoneNumber,
        cellId: cellId || null,
        lastSeenActivity: new Date(lastSeenActivity),
      })
      .returning()
    
    return result[0] || null
  }
}

// AI Alerts queries
export async function getAiAlerts(cellId?: string) {
  if (cellId) {
    return await db
      .select()
      .from(aiAlerts)
      .where(eq(aiAlerts.cellId, cellId))
      .orderBy(asc(aiAlerts.createdAt))
  } else {
    return await db
      .select()
      .from(aiAlerts)
      .orderBy(asc(aiAlerts.createdAt))
  }
}

export async function getAiAlertById(id: string) {
  const result = await db
    .select()
    .from(aiAlerts)
    .where(eq(aiAlerts.id, id))
    .limit(1)
  
  return result[0] || null
}

export async function getEnabledAiAlerts(cellId?: string) {
  if (cellId) {
    return await db
      .select()
      .from(aiAlerts)
      .where(and(eq(aiAlerts.enabled, true), eq(aiAlerts.cellId, cellId)))
  } else {
    return await db
      .select()
      .from(aiAlerts)
      .where(eq(aiAlerts.enabled, true))
  }
}

export async function createAiAlert(
  name: string,
  type: 'ai' | 'keyword',
  condition: string,
  cellId?: string
) {
  const result = await db
    .insert(aiAlerts)
    .values({
      name,
      type,
      condition,
      cellId: cellId || null,
      enabled: true,
    })
    .returning()
  
  return result[0]
}

export async function updateAiAlert(
  id: string,
  name?: string,
  type?: 'ai' | 'keyword',
  condition?: string,
  enabled?: boolean
) {
  const updateData: any = {
    updatedAt: new Date(),
  }
  
  if (name !== undefined) updateData.name = name
  if (type !== undefined) updateData.type = type
  if (condition !== undefined) updateData.condition = condition
  if (enabled !== undefined) updateData.enabled = enabled
  
  const result = await db
    .update(aiAlerts)
    .set(updateData)
    .where(eq(aiAlerts.id, id))
    .returning()
  
  return result[0] || null
}

export async function deleteAiAlert(id: string) {
  await db
    .delete(aiAlerts)
    .where(eq(aiAlerts.id, id))
}

// AI Alert Triggers queries
export async function getAiAlertTriggers(phoneNumber?: string, cellId?: string, dismissed?: boolean) {
  const conditions = []
  
  if (phoneNumber) {
    conditions.push(eq(aiAlertTriggers.phoneNumber, phoneNumber))
  }
  if (cellId) {
    conditions.push(eq(aiAlertTriggers.cellId, cellId))
  }
  if (dismissed !== undefined) {
    conditions.push(eq(aiAlertTriggers.dismissed, dismissed))
  }
  
  if (conditions.length > 0) {
    return await db
      .select()
      .from(aiAlertTriggers)
      .where(and(...conditions))
      .orderBy(desc(aiAlertTriggers.triggeredAt))
  } else {
    return await db
      .select()
      .from(aiAlertTriggers)
      .orderBy(desc(aiAlertTriggers.triggeredAt))
  }
}

export async function getActiveAlertTriggersForContact(phoneNumber: string, cellId?: string) {
  return await db
    .select()
    .from(aiAlertTriggers)
    .where(
      cellId
        ? and(
            eq(aiAlertTriggers.phoneNumber, phoneNumber),
            eq(aiAlertTriggers.cellId, cellId),
            eq(aiAlertTriggers.dismissed, false)
          )
        : and(
            eq(aiAlertTriggers.phoneNumber, phoneNumber),
            eq(aiAlertTriggers.dismissed, false)
          )
    )
    .orderBy(desc(aiAlertTriggers.triggeredAt))
}

export async function createAiAlertTrigger(
  alertId: string,
  phoneNumber: string,
  messageId: string,
  cellId?: string
) {
  // Check if this alert was already triggered for this message (avoid duplicates)
  const existing = await db
    .select()
    .from(aiAlertTriggers)
    .where(
      and(
        eq(aiAlertTriggers.alertId, alertId),
        eq(aiAlertTriggers.messageId, messageId)
      )
    )
    .limit(1)
  
  if (existing.length > 0) {
    return existing[0]
  }
  
  const result = await db
    .insert(aiAlertTriggers)
    .values({
      alertId,
      phoneNumber,
      messageId,
      cellId: cellId || null,
      dismissed: false,
    })
    .returning()
  
  return result[0]
}

export async function dismissAiAlertTrigger(id: string) {
  const result = await db
    .update(aiAlertTriggers)
    .set({
      dismissed: true,
    })
    .where(eq(aiAlertTriggers.id, id))
    .returning()
  
  return result[0] || null
}

export async function dismissAllAlertTriggersForContact(phoneNumber: string, cellId?: string) {
  await db
    .update(aiAlertTriggers)
    .set({
      dismissed: true,
    })
    .where(
      cellId
        ? and(
            eq(aiAlertTriggers.phoneNumber, phoneNumber),
            eq(aiAlertTriggers.cellId, cellId)
          )
        : eq(aiAlertTriggers.phoneNumber, phoneNumber)
    )
}

// Column Colors queries
export async function getColumnColors(cellId?: string) {
  if (cellId) {
    return await db
      .select()
      .from(columnColors)
      .where(eq(columnColors.cellId, cellId))
  } else {
    return await db
      .select()
      .from(columnColors)
      .where(isNull(columnColors.cellId))
  }
}

export async function getColumnColor(columnId: string, cellId?: string) {
  const result = await db
    .select()
    .from(columnColors)
    .where(
      cellId
        ? and(
            eq(columnColors.columnId, columnId),
            eq(columnColors.cellId, cellId)
          )
        : and(
            eq(columnColors.columnId, columnId),
            isNull(columnColors.cellId)
          )
    )
    .limit(1)
  
  return result[0] || null
}

export async function saveColumnColor(columnId: string, color: string, cellId?: string) {
  // Try to find existing record
  const existing = await getColumnColor(columnId, cellId)
  
  if (existing) {
    // Update existing record
    const result = await db
      .update(columnColors)
      .set({
        color,
        updatedAt: new Date(),
      })
      .where(eq(columnColors.id, existing.id))
      .returning()
    
    return result[0] || null
  } else {
    // Insert new record
    const result = await db
      .insert(columnColors)
      .values({
        columnId,
        cellId: cellId || null,
        color,
      })
      .returning()
    
    return result[0] || null
  }
}

export async function deleteColumnColor(columnId: string, cellId?: string) {
  await db
    .delete(columnColors)
    .where(
      cellId
        ? and(
            eq(columnColors.columnId, columnId),
            eq(columnColors.cellId, cellId)
          )
        : and(
            eq(columnColors.columnId, columnId),
            isNull(columnColors.cellId)
          )
    )
}

// Column Visibility queries
export async function getColumnVisibility(cellId?: string): Promise<Record<string, boolean | undefined> | null> {
  const result = await db
    .select()
    .from(columnVisibility)
    .where(
      cellId
        ? eq(columnVisibility.cellId, cellId)
        : isNull(columnVisibility.cellId)
    )
    .limit(1)
  
  if (result[0]?.visibilityState) {
    try {
      return JSON.parse(result[0].visibilityState) as Record<string, boolean | undefined>
    } catch (error) {
      console.error('Error parsing column visibility state:', error)
      return null
    }
  }
  
  return null
}

export async function saveColumnVisibility(visibilityState: Record<string, boolean | undefined>, cellId?: string) {
  const visibilityStateJson = JSON.stringify(visibilityState)
  
  // Try to find existing record
  const existing = await db
    .select()
    .from(columnVisibility)
    .where(
      cellId
        ? eq(columnVisibility.cellId, cellId)
        : isNull(columnVisibility.cellId)
    )
    .limit(1)
  
  if (existing[0]) {
    // Update existing record
    const result = await db
      .update(columnVisibility)
      .set({
        visibilityState: visibilityStateJson,
        updatedAt: new Date(),
      })
      .where(eq(columnVisibility.id, existing[0].id))
      .returning()
    
    return result[0] || null
  } else {
    // Insert new record
    const result = await db
      .insert(columnVisibility)
      .values({
        cellId: cellId || null,
        visibilityState: visibilityStateJson,
      })
      .returning()
    
    return result[0] || null
  }
}

// Integration queries
export async function getIntegration(cellId: string, type: string) {
  const result = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.cellId, cellId),
        eq(integrations.type, type)
      )
    )
    .limit(1)
  
  return result[0] || null
}

export async function getIntegrationStatus(cellId: string, type: string) {
  const integration = await getIntegration(cellId, type)
  
  if (!integration) {
    return {
      connected: false,
      syncedContactsCount: 0,
    }
  }
  
  return {
    connected: true,
    connectedAt: integration.connectedAt?.toISOString(),
    lastSyncedAt: integration.lastSyncedAt?.toISOString(),
    syncedContactsCount: integration.syncedContactsCount || 0,
  }
}

/**
 * Create integration (legacy - for token-based integrations)
 * @deprecated Use createIntegrationWithConnectionId for Composio integrations
 */
export async function createIntegration(
  cellId: string,
  type: string,
  accessToken: string,
  refreshToken: string,
  instanceUrl: string,
  metadata?: Record<string, any>
) {
  const result = await db
    .insert(integrations)
    .values({
      cellId,
      type,
      accessToken,
      refreshToken,
      instanceUrl,
      metadata: metadata ? JSON.stringify(metadata) : null,
      connectedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
  
  return result[0] || null
}

/**
 * Create integration with Composio connection ID
 * @param cellId - Cell ID
 * @param type - Integration type (e.g., 'salesforce')
 * @param connectionId - Composio connection ID
 * @param metadata - Additional metadata (optional)
 */
export async function createIntegrationWithConnectionId(
  cellId: string,
  type: string,
  connectionId: string,
  metadata?: Record<string, any>
) {
  const integrationMetadata = {
    connectionId,
    ...metadata,
  }

  const result = await db
    .insert(integrations)
    .values({
      cellId,
      type,
      accessToken: null, // Not used for Composio
      refreshToken: null, // Not used for Composio
      instanceUrl: null, // Not used for Composio
      metadata: JSON.stringify(integrationMetadata),
      connectedAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
  
  return result[0] || null
}

/**
 * Get connection ID from integration metadata
 * @param integration - Integration record
 * @returns Connection ID or null
 */
export function getConnectionIdFromIntegration(integration: { metadata: string | null }): string | null {
  if (!integration.metadata) {
    return null
  }

  try {
    const metadata = JSON.parse(integration.metadata)
    return metadata.connectionId || null
  } catch {
    return null
  }
}

export async function updateIntegration(
  id: string,
  updates: {
    accessToken?: string | null
    refreshToken?: string | null
    instanceUrl?: string | null
    lastSyncedAt?: Date
    syncedContactsCount?: number
    metadata?: Record<string, any>
    connectionId?: string // For Composio integrations
  }
) {
  const updateData: any = {
    updatedAt: new Date(),
  }
  
  if (updates.accessToken !== undefined) updateData.accessToken = updates.accessToken
  if (updates.refreshToken !== undefined) updateData.refreshToken = updates.refreshToken
  if (updates.instanceUrl !== undefined) updateData.instanceUrl = updates.instanceUrl
  if (updates.lastSyncedAt !== undefined) updateData.lastSyncedAt = updates.lastSyncedAt
  if (updates.syncedContactsCount !== undefined) updateData.syncedContactsCount = updates.syncedContactsCount
  
  // Handle metadata updates
  if (updates.metadata !== undefined || updates.connectionId !== undefined) {
    // Get existing integration to merge metadata
    const existing = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id))
      .limit(1)
    
    let existingMetadata: Record<string, any> = {}
    if (existing[0]?.metadata) {
      try {
        existingMetadata = JSON.parse(existing[0].metadata)
      } catch {
        // Invalid JSON, start fresh
      }
    }
    
    // Merge metadata
    const newMetadata = {
      ...existingMetadata,
      ...(updates.metadata || {}),
      ...(updates.connectionId ? { connectionId: updates.connectionId } : {}),
    }
    
    updateData.metadata = JSON.stringify(newMetadata)
  }
  
  const result = await db
    .update(integrations)
    .set(updateData)
    .where(eq(integrations.id, id))
    .returning()
  
  return result[0] || null
}

export async function deleteIntegration(cellId: string, type: string) {
  await db
    .delete(integrations)
    .where(
      and(
        eq(integrations.cellId, cellId),
        eq(integrations.type, type)
      )
    )
}

// API Key functions
const API_KEY_PREFIX = 'sk_live_'
const API_KEY_LENGTH = 32 // bytes of random data
const HASH_ITERATIONS = 100000
const HASH_KEY_LENGTH = 64

/**
 * Generate a new API key with prefix
 */
function generateApiKey(): string {
  const randomPart = randomBytes(API_KEY_LENGTH).toString('base64url')
  return `${API_KEY_PREFIX}${randomPart}`
}

/**
 * Hash an API key using PBKDF2
 */
function hashApiKey(key: string): string {
  // Use a fixed salt derived from the key prefix for consistency
  // In production, you might want to store salt separately per key
  const salt = Buffer.from('sms-dashboard-api-key-salt', 'utf-8')
  const hash = pbkdf2Sync(key, salt, HASH_ITERATIONS, HASH_KEY_LENGTH, 'sha256')
  return hash.toString('base64')
}

/**
 * Verify an API key against a hash
 */
function verifyApiKey(key: string, hash: string): boolean {
  try {
    const keyHash = hashApiKey(key)
    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(Buffer.from(keyHash), Buffer.from(hash))
  } catch {
    return false
  }
}

/**
 * Create a new API key for a cell
 * Returns the plain key (only shown once) and the database record
 */
export async function createApiKey(cellId: string, name: string | null, createdBy: string): Promise<{ id: string; key: string; name: string | null; createdAt: Date }> {
  const plainKey = generateApiKey()
  const keyHash = hashApiKey(plainKey)
  
  const result = await db
    .insert(apiKeys)
    .values({
      cellId,
      keyHash,
      name: name || null,
      createdBy,
    })
    .returning()
  
  if (!result[0]) {
    throw new Error('Failed to create API key')
  }
  
  return {
    id: result[0].id,
    key: plainKey,
    name: result[0].name,
    createdAt: result[0].createdAt || new Date(),
  }
}

/**
 * Get API key by plain key (for authentication)
 * Returns the API key record with cell information if valid
 */
export async function getApiKeyByKey(apiKey: string): Promise<{ id: string; cellId: string; name: string | null; lastUsedAt: Date | null } | null> {
  // Get all API keys (we need to verify against each hash)
  // In production with many keys, you might want to optimize this with a lookup table
  const allKeys = await db
    .select({
      id: apiKeys.id,
      cellId: apiKeys.cellId,
      keyHash: apiKeys.keyHash,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
    })
    .from(apiKeys)
  
  // Find matching key by verifying hash
  for (const keyRecord of allKeys) {
    if (verifyApiKey(apiKey, keyRecord.keyHash)) {
      return {
        id: keyRecord.id,
        cellId: keyRecord.cellId,
        name: keyRecord.name,
        lastUsedAt: keyRecord.lastUsedAt,
      }
    }
  }
  
  return null
}

/**
 * Get an API key by ID (without key value)
 */
export async function getApiKeyById(keyId: string): Promise<{ id: string; cellId: string; name: string | null; lastUsedAt: Date | null; createdAt: Date; createdBy: string } | null> {
  const result = await db
    .select({
      id: apiKeys.id,
      cellId: apiKeys.cellId,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      createdBy: apiKeys.createdBy,
    })
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .limit(1)
  
  if (!result[0]) {
    return null
  }
  
  return {
    ...result[0],
    createdAt: result[0].createdAt || new Date(),
  }
}

/**
 * Get all API keys for a cell (without key values)
 */
export async function getApiKeysByCell(cellId: string): Promise<Array<{ id: string; name: string | null; lastUsedAt: Date | null; createdAt: Date; createdBy: string }>> {
  const result = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      lastUsedAt: apiKeys.lastUsedAt,
      createdAt: apiKeys.createdAt,
      createdBy: apiKeys.createdBy,
    })
    .from(apiKeys)
    .where(eq(apiKeys.cellId, cellId))
    .orderBy(desc(apiKeys.createdAt))
  
  return result.map(key => ({
    ...key,
    createdAt: key.createdAt || new Date(),
  }))
}

/**
 * Delete an API key
 */
export async function deleteApiKey(keyId: string, cellId: string): Promise<boolean> {
  const result = await db
    .delete(apiKeys)
    .where(
      and(
        eq(apiKeys.id, keyId),
        eq(apiKeys.cellId, cellId)
      )
    )
    .returning()
  
  return result.length > 0
}

/**
 * Update the last used timestamp for an API key
 */
export async function updateApiKeyLastUsed(keyId: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({
      lastUsedAt: new Date(),
    })
    .where(eq(apiKeys.id, keyId))
}

