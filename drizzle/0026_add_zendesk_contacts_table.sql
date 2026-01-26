-- Add zendesk_contacts table for storing synced Zendesk users data
CREATE TABLE IF NOT EXISTS "zendesk_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phone_number" varchar NOT NULL,
  "cell_id" uuid REFERENCES "cells"("id") ON DELETE CASCADE,
  "zendesk_id" varchar NOT NULL,
  "name" varchar,
  "email" varchar,
  "organization_id" varchar,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "zendesk_contacts_phone_cell_unique" UNIQUE("phone_number", "cell_id")
);
