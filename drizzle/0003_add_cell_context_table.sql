-- Create cell_context table
CREATE TABLE IF NOT EXISTS "cell_context" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cell_id" uuid NOT NULL,
	"type" varchar NOT NULL,
	"name" varchar NOT NULL,
	"content" text,
	"mime_type" varchar,
	"file_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cell_context_cell_id_cells_id_fk'
  ) THEN
    ALTER TABLE "cell_context" ADD CONSTRAINT "cell_context_cell_id_cells_id_fk" 
    FOREIGN KEY ("cell_id") REFERENCES "cells"("id") ON DELETE CASCADE;
  END IF;
END $$;



