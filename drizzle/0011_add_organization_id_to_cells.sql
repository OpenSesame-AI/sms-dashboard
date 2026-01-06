-- Add organization_id column to cells table
-- This column is nullable - null means personal cell, non-null means organization cell
ALTER TABLE "cells" ADD COLUMN IF NOT EXISTS "organization_id" varchar;


