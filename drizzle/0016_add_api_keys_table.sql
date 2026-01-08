-- Create api_keys table
-- Stores API keys for programmatic access, scoped to cells
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cell_id" uuid NOT NULL REFERENCES "cells"("id") ON DELETE CASCADE,
  "key_hash" text NOT NULL,
  "name" varchar,
  "last_used_at" timestamp with time zone,
  "created_by" varchar NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

-- Create index on cell_id for faster lookups
CREATE INDEX IF NOT EXISTS "api_keys_cell_id_idx" ON "api_keys"("cell_id");

-- Create index on key_hash for faster authentication lookups
CREATE INDEX IF NOT EXISTS "api_keys_key_hash_idx" ON "api_keys"("key_hash");

