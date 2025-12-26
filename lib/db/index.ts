import { drizzle } from 'drizzle-orm/postgres-js'
import postgres, { Sql } from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set')
}

const connectionString = process.env.DATABASE_URL

// Use global singleton to prevent connection exhaustion in development
// Next.js hot reloading can re-evaluate modules, creating new connections
const globalForDb = globalThis as unknown as {
  client: Sql | undefined
}

const client = globalForDb.client ?? postgres(connectionString, { max: 1 })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.client = client
}

export const db = drizzle(client, { schema })
export { client as postgresClient }

