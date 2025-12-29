import { pgTable, varchar, text, timestamp, uuid, unique, integer } from 'drizzle-orm/pg-core'

export const phoneUserMappings = pgTable('phone_user_mappings', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number').notNull(),
  userId: varchar('user_id').notNull(),
  cellId: uuid('cell_id').references(() => cells.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
})

export const smsConversations = pgTable('sms_conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  phoneNumber: varchar('phone_number').notNull(),
  userId: varchar('user_id').notNull(),
  cellId: uuid('cell_id').references(() => cells.id),
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

