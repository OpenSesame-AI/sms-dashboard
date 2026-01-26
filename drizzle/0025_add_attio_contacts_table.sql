-- Add attio_contacts table for storing synced Attio people data
CREATE TABLE IF NOT EXISTS "attio_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone_number" varchar NOT NULL,
  "cell_id" uuid REFERENCES "cells"("id") ON DELETE CASCADE,
  "attio_id" varchar NOT NULL,
  "first_name" varchar,
  "last_name" varchar,
  "email" varchar,
  "company_name" varchar,
  "job_title" varchar,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "attio_contacts_phone_cell_unique" UNIQUE("phone_number", "cell_id")
);
