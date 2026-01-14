-- Create hubspot_contacts table
-- Stores HubSpot contact data linked to phone numbers
CREATE TABLE IF NOT EXISTS "hubspot_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone_number" varchar NOT NULL,
  "cell_id" uuid REFERENCES "cells"("id") ON DELETE CASCADE,
  "hubspot_id" varchar NOT NULL,
  "first_name" varchar,
  "last_name" varchar,
  "email" varchar,
  "company_id" varchar,
  "company_name" varchar,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "hubspot_contacts_phone_number_cell_id_unique" UNIQUE("phone_number", "cell_id")
);

-- Create index on phone_number and cell_id for faster joins
CREATE INDEX IF NOT EXISTS "hubspot_contacts_phone_number_cell_id_idx" ON "hubspot_contacts"("phone_number", "cell_id");
