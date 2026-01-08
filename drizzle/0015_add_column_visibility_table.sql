-- Create column_visibility table
-- Stores column visibility preferences per cell
CREATE TABLE IF NOT EXISTS "column_visibility" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cell_id" uuid REFERENCES "cells"("id") ON DELETE CASCADE,
  "visibility_state" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "column_visibility_cell_id_unique" UNIQUE("cell_id")
);

-- Create index on cell_id for faster lookups
CREATE INDEX IF NOT EXISTS "column_visibility_cell_id_idx" ON "column_visibility"("cell_id");

