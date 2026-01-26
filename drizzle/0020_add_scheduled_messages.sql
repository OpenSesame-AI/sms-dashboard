-- Create scheduled_messages table
-- Stores messages scheduled to be sent at a future time
-- Supports both individual and bulk scheduled messages
CREATE TABLE IF NOT EXISTS "scheduled_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cell_id" uuid NOT NULL REFERENCES "cells"("id") ON DELETE CASCADE,
  "message" text NOT NULL,
  "recipients" text NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "status" varchar NOT NULL DEFAULT 'pending',
  "created_by" varchar NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "sent_at" timestamp with time zone,
  "error" text
);

-- Create index on cell_id for faster lookups
CREATE INDEX IF NOT EXISTS "scheduled_messages_cell_id_idx" ON "scheduled_messages"("cell_id");

-- Create index on status and scheduled_for for cron job queries
CREATE INDEX IF NOT EXISTS "scheduled_messages_status_scheduled_for_idx" ON "scheduled_messages"("status", "scheduled_for");

-- Create index on created_by for user-specific queries
CREATE INDEX IF NOT EXISTS "scheduled_messages_created_by_idx" ON "scheduled_messages"("created_by");
