-- Create integrations table
-- Stores OAuth tokens and connection information for third-party integrations (e.g., Salesforce)
CREATE TABLE IF NOT EXISTS "integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cell_id" uuid NOT NULL REFERENCES "cells"("id") ON DELETE CASCADE,
  "type" varchar NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "instance_url" varchar,
  "connected_at" timestamp with time zone DEFAULT now(),
  "last_synced_at" timestamp with time zone,
  "synced_contacts_count" integer DEFAULT 0,
  "metadata" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "integrations_cell_id_type_unique" UNIQUE("cell_id", "type")
);

