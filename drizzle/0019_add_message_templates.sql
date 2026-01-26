-- Create message_templates table
-- Stores pre-designed message templates with variable substitution support
-- Templates can be per-cell (cell_id set) or global (cell_id null)
CREATE TABLE IF NOT EXISTS "message_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cell_id" uuid REFERENCES "cells"("id") ON DELETE CASCADE,
  "name" varchar NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

-- Create index on cell_id for faster lookups
CREATE INDEX IF NOT EXISTS "message_templates_cell_id_idx" ON "message_templates"("cell_id");

-- Create index on name for faster searches
CREATE INDEX IF NOT EXISTS "message_templates_name_idx" ON "message_templates"("name");
