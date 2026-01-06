-- Add channel column to sms_conversations table
-- This column distinguishes between 'sms' and 'whatsapp' messages
-- Default value is 'sms' for backward compatibility
ALTER TABLE "sms_conversations" ADD COLUMN IF NOT EXISTS "channel" varchar NOT NULL DEFAULT 'sms';

-- Update all existing records to have channel = 'sms' (explicitly set for safety)
UPDATE "sms_conversations" SET "channel" = 'sms' WHERE "channel" IS NULL;

