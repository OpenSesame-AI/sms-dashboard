import { pgTable, varchar, text, timestamp, uuid, unique, integer, boolean } from 'drizzle-orm/pg-core'

export const phoneUserMappings = pgTable('phone_user_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number').notNull(),
  userId: varchar('user_id').notNull(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const smsConversations = pgTable('sms_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number').notNull(),
  userId: varchar('user_id').notNull(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }),
  direction: varchar('direction').notNull(),
  messageBody: text('message_body').notNull(),
  messageSid: varchar('message_sid'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
  status: varchar('status'),
})

export const aiAnalysisColumns = pgTable('ai_analysis_columns', {
  id: uuid('id').primaryKey().defaultRandom(),
  columnKey: varchar('column_key').notNull().unique(),
  name: varchar('name').notNull(),
  prompt: text('prompt').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const aiAnalysisResults = pgTable('ai_analysis_results', {
  id: uuid('id').primaryKey().defaultRandom(),
  columnKey: varchar('column_key').notNull(),
  phoneNumber: varchar('phone_number').notNull(),
  result: text('result'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueColumnPhone: unique().on(table.columnKey, table.phoneNumber),
}))

export const cells = pgTable('cells', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number').notNull(),
  name: varchar('name').notNull(),
  userId: varchar('user_id').notNull(),
  organizationId: varchar('organization_id'), // nullable - null means personal cell
  systemPrompt: text('system_prompt'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const cellContext = pgTable('cell_context', {
  id: uuid('id').primaryKey().defaultRandom(),
  cellId: uuid('cell_id').notNull().references(() => cells.id, { onDelete: 'cascade' }),
  type: varchar('type').notNull(), // 'text' or 'file'
  name: varchar('name').notNull(), // display name or filename
  content: text('content'), // for text type, stores the content; for files, stores base64
  mimeType: varchar('mime_type'), // for files only (e.g., 'application/pdf', 'image/png')
  fileSize: integer('file_size'), // for files only, in bytes
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const contactSeenState = pgTable('contact_seen_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number').notNull(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }),
  lastSeenActivity: timestamp('last_seen_activity', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniquePhoneCell: unique().on(table.phoneNumber, table.cellId),
}))

export const aiAlerts = pgTable('ai_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name').notNull(),
  type: varchar('type').notNull(), // 'ai' or 'keyword'
  condition: text('condition').notNull(), // AI prompt or keywords
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const aiAlertTriggers = pgTable('ai_alert_triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  alertId: uuid('alert_id').notNull().references(() => aiAlerts.id, { onDelete: 'cascade' }),
  phoneNumber: varchar('phone_number').notNull(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }),
  messageId: uuid('message_id').references(() => smsConversations.id, { onDelete: 'cascade' }),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).defaultNow(),
  dismissed: boolean('dismissed').notNull().default(false),
})

export const columnColors = pgTable('column_colors', {
  id: uuid('id').primaryKey().defaultRandom(),
  columnId: varchar('column_id').notNull(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }),
  color: varchar('color').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueColumnCell: unique().on(table.columnId, table.cellId),
}))

export const columnVisibility = pgTable('column_visibility', {
  id: uuid('id').primaryKey().defaultRandom(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }),
  visibilityState: text('visibility_state').notNull(), // JSON stored as text: Record<string, boolean | undefined>
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueCell: unique().on(table.cellId),
}))

export const availablePhoneNumbers = pgTable('available_phone_numbers', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  cellId: uuid('cell_id').notNull().references(() => cells.id, { onDelete: 'cascade' }),
  type: varchar('type').notNull(), // e.g., 'salesforce'
  accessToken: text('access_token'), // encrypted (deprecated - use metadata.connectionId for Composio)
  refreshToken: text('refresh_token'), // encrypted (deprecated - use metadata.connectionId for Composio)
  instanceUrl: varchar('instance_url'), // deprecated - use metadata.connectionId for Composio
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  syncedContactsCount: integer('synced_contacts_count').default(0),
  metadata: text('metadata'), // JSON stored as text. For Composio: { connectionId: string }
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniqueCellType: unique().on(table.cellId, table.type),
}))

export const salesforceContacts = pgTable('salesforce_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number').notNull(),
  cellId: uuid('cell_id').references(() => cells.id, { onDelete: 'cascade' }),
  salesforceId: varchar('salesforce_id').notNull(),
  firstName: varchar('first_name'),
  lastName: varchar('last_name'),
  email: varchar('email'),
  accountId: varchar('account_id'),
  accountName: varchar('account_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  uniquePhoneCell: unique().on(table.phoneNumber, table.cellId),
}))

export type PhoneUserMapping = typeof phoneUserMappings.$inferSelect
export type NewPhoneUserMapping = typeof phoneUserMappings.$inferInsert
export type SmsConversation = typeof smsConversations.$inferSelect
export type NewSmsConversation = typeof smsConversations.$inferInsert
export type AiAnalysisColumn = typeof aiAnalysisColumns.$inferSelect
export type NewAiAnalysisColumn = typeof aiAnalysisColumns.$inferInsert
export type AiAnalysisResult = typeof aiAnalysisResults.$inferSelect
export type NewAiAnalysisResult = typeof aiAnalysisResults.$inferInsert
export type Cell = typeof cells.$inferSelect
export type NewCell = typeof cells.$inferInsert
export type CellContext = typeof cellContext.$inferSelect
export type NewCellContext = typeof cellContext.$inferInsert
export type ContactSeenState = typeof contactSeenState.$inferSelect
export type NewContactSeenState = typeof contactSeenState.$inferInsert
export type AiAlert = typeof aiAlerts.$inferSelect
export type NewAiAlert = typeof aiAlerts.$inferInsert
export type AiAlertTrigger = typeof aiAlertTriggers.$inferSelect
export type NewAiAlertTrigger = typeof aiAlertTriggers.$inferInsert
export type ColumnColor = typeof columnColors.$inferSelect
export type NewColumnColor = typeof columnColors.$inferInsert
export type ColumnVisibility = typeof columnVisibility.$inferSelect
export type NewColumnVisibility = typeof columnVisibility.$inferInsert
export type AvailablePhoneNumber = typeof availablePhoneNumbers.$inferSelect
export type NewAvailablePhoneNumber = typeof availablePhoneNumbers.$inferInsert
export type Integration = typeof integrations.$inferSelect
export type NewIntegration = typeof integrations.$inferInsert
export type SalesforceContact = typeof salesforceContacts.$inferSelect
export type NewSalesforceContact = typeof salesforceContacts.$inferInsert

