// Re-export Contact type from queries for backward compatibility
export type { Contact, ConversationMessage } from './db/queries'

// Re-export database query functions
export { getContacts, getContactById, getConversationsByPhoneNumber } from './db/queries'

