-- Apply only the AI analysis tables
-- This script creates the new tables without modifying existing ones

CREATE TABLE IF NOT EXISTS "ai_analysis_columns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"column_key" varchar NOT NULL,
	"name" varchar NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "ai_analysis_columns_column_key_unique" UNIQUE("column_key")
);

CREATE TABLE IF NOT EXISTS "ai_analysis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"column_key" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"result" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);

-- Add unique constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ai_analysis_results_column_key_phone_number_unique'
    ) THEN
        ALTER TABLE "ai_analysis_results" 
        ADD CONSTRAINT "ai_analysis_results_column_key_phone_number_unique" 
        UNIQUE("column_key","phone_number");
    END IF;
END $$;




