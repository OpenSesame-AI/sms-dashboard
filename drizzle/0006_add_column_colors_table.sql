-- Add column_colors table
CREATE TABLE IF NOT EXISTS "column_colors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "column_id" varchar NOT NULL,
  "cell_id" uuid REFERENCES "cells"("id") ON DELETE CASCADE,
  "color" varchar NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  UNIQUE("column_id", "cell_id")
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_column_colors_column_id ON column_colors(column_id);
CREATE INDEX IF NOT EXISTS idx_column_colors_cell_id ON column_colors(cell_id);

