-- Add agencyzoom_contacts table for storing synced AgencyZoom contact data (customers and leads)
CREATE TABLE IF NOT EXISTS "agencyzoom_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone_number" varchar NOT NULL,
  "cell_id" uuid REFERENCES "cells"("id") ON DELETE CASCADE,
  "agencyzoom_id" varchar NOT NULL,
  "first_name" varchar,
  "last_name" varchar,
  "email" varchar,
  "company_name" varchar,
  "source_type" varchar NOT NULL DEFAULT 'customer', -- 'customer' or 'lead'
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "agencyzoom_contacts_phone_cell_unique" UNIQUE("phone_number", "cell_id")
);
