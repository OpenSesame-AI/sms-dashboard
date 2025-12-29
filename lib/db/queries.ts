import { db, postgresClient } from './index'
import { phoneUserMappings, smsConversations, aiAnalysisColumns, aiAnalysisResults, cells, cellContext } from './schema'
import { eq, sql, desc, asc, and, gte } from 'drizzle-orm'

export type Contact = {
  id: string
  phoneNumber: string
  userId: string
  lastMessage: string | null
  status: string | null
  numberOfMessages: number
  started: string | null
  lastActivity: string | null
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
  // Optimized single query using LEFT JOIN and GROUP BY to avoid N+1 pattern
  // This reduces query count from N+1 to just 1, regardless of contact count
  
  // Use postgres client directly for raw SQL queries (same as scripts)
  const results = cellId
    ? await postgresClient`
        SELECT 
          p.id,
          p.phone_number as "phoneNumber",
          p.user_id as "userId",
          p.created_at as "createdAt",
          COUNT(s.id)::int as "numberOfMessages",
          MAX(s.message_body) as "lastMessage",
          MAX(s.timestamp) as "lastActivity",
          (
            SELECT s2.status
            FROM sms_conversations s2
            WHERE s2.phone_number = p.phone_number
              AND s2.cell_id = ${cellId}
            ORDER BY s2.timestamp DESC
            LIMIT 1
          ) as "lastStatus"
        FROM phone_user_mappings p
        LEFT JOIN sms_conversations s ON s.phone_number = p.phone_number
          AND s.cell_id = ${cellId}
        WHERE p.cell_id = ${cellId}
        GROUP BY p.id, p.phone_number, p.user_id, p.created_at
        ORDER BY MAX(s.timestamp) DESC NULLS LAST
      `
    : await postgresClient`
        SELECT 
          p.id,
          p.phone_number as "phoneNumber",
          p.user_id as "userId",
          p.created_at as "createdAt",
          COUNT(s.id)::int as "numberOfMessages",
          MAX(s.message_body) as "lastMessage",
          MAX(s.timestamp) as "lastActivity",
          (
            SELECT s2.status
            FROM sms_conversations s2
            WHERE s2.phone_number = p.phone_number
            ORDER BY s2.timestamp DESC
            LIMIT 1
          ) as "lastStatus"
        FROM phone_user_mappings p
        LEFT JOIN sms_conversations s ON s.phone_number = p.phone_number
        GROUP BY p.id, p.phone_number, p.user_id, p.created_at
        ORDER BY MAX(s.timestamp) DESC NULLS LAST
      `

  // Ensure results is an array
  if (!Array.isArray(results)) {
    console.error('[getContacts] Results is not an array:', typeof results, results)
    return []
  }

  const contacts: Contact[] = results.map((row: any) => {
    try {
      return {
        id: row.id,
        phoneNumber: row.phoneNumber,
        userId: row.userId,
        lastMessage: row.lastMessage || null,
        status: row.lastStatus || 'pending',
        numberOfMessages: row.numberOfMessages || 0,
        started: formatDate(row.createdAt),
        lastActivity: formatDateTime(row.lastActivity),
      }
    } catch (err) {
      console.error('[getContacts] Error mapping row:', err, row)
      throw err
    }
  })

  return contacts
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
    })
    .from(smsConversations)
    .where(eq(smsConversations.phoneNumber, phoneMapping.phoneNumber))

  const stats = conversationStats[0]

  return {
    id: phoneMapping.id,
    phoneNumber: phoneMapping.phoneNumber,
    userId: phoneMapping.userId,
    lastMessage: stats?.lastMessage || null,
    status: stats?.lastStatus || 'pending',
    numberOfMessages: stats?.count || 0,
    started: formatDate(phoneMapping.createdAt),
    lastActivity: formatDateTime(stats?.lastActivity),
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
  const conversations = await db
    .select()
    .from(smsConversations)
    .where(
      cellId
        ? and(
            eq(smsConversations.phoneNumber, phoneNumber),
            eq(smsConversations.cellId, cellId)
          )
        : eq(smsConversations.phoneNumber, phoneNumber)
    )
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

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Get total messages
  const totalMessagesResult = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)

  // Get total contacts
  const totalContactsResult = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(phoneUserMappings)

  // Get inbound/outbound counts
  const directionStats = await db
    .select({
      direction: smsConversations.direction,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .groupBy(smsConversations.direction)

  // Get status breakdown for delivery rate
  const statusStats = await db
    .select({
      status: smsConversations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
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

export async function getMessagesOverTime(): Promise<MessagesOverTime[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const results = await db
    .select({
      date: sql<string>`to_char(${smsConversations.timestamp}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .where(gte(smsConversations.timestamp, thirtyDaysAgo))
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

export async function getMessagesByDirection(): Promise<MessagesByDirection[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const results = await db
    .select({
      date: sql<string>`to_char(${smsConversations.timestamp}, 'YYYY-MM-DD')`,
      direction: smsConversations.direction,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
    .where(gte(smsConversations.timestamp, thirtyDaysAgo))
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

export async function getStatusBreakdown(): Promise<StatusBreakdown[]> {
  const results = await db
    .select({
      status: smsConversations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
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

export async function getTopActiveContacts(limit: number = 10): Promise<TopActiveContact[]> {
  const results = await db
    .select({
      phoneNumber: smsConversations.phoneNumber,
      userId: smsConversations.userId,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
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

export async function getNewContactsOverTime(): Promise<NewContactsOverTime[]> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const results = await db
    .select({
      date: sql<string>`to_char(${phoneUserMappings.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(phoneUserMappings)
    .where(gte(phoneUserMappings.createdAt, thirtyDaysAgo))
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

export async function getHourlyDistribution(): Promise<HourlyDistribution[]> {
  const results = await db
    .select({
      hour: sql<number>`extract(hour from ${smsConversations.timestamp})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(smsConversations)
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
export async function getAllCells() {
  return await db.select().from(cells).orderBy(asc(cells.createdAt))
}

export async function getCellById(id: string) {
  const result = await db
    .select()
    .from(cells)
    .where(eq(cells.id, id))
    .limit(1)
  
  return result[0] || null
}


export async function createCell(phoneNumber: string, name: string) {
  const result = await db
    .insert(cells)
    .values({
      phoneNumber,
      name,
    })
    .returning()
  
  return result[0]
}

export async function updateCell(id: string, name: string, phoneNumber?: string) {
  const updateData: { name: string; phoneNumber?: string; updatedAt: Date } = {
    name,
    updatedAt: new Date(),
  }
  
  if (phoneNumber) {
    updateData.phoneNumber = phoneNumber
  }
  
  const result = await db
    .update(cells)
    .set(updateData)
    .where(eq(cells.id, id))
    .returning()
  
  return result[0] || null
}

export async function deleteCell(id: string) {
  await db
    .delete(cells)
    .where(eq(cells.id, id))
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

