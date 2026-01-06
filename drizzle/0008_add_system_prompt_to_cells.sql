-- Add system_prompt column to cells table
ALTER TABLE "cells" ADD COLUMN IF NOT EXISTS "system_prompt" text;


