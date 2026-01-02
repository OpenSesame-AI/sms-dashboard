-- Add CASCADE delete to sms_conversations.cell_id foreign key
-- First, drop the existing constraint
ALTER TABLE "sms_conversations" 
DROP CONSTRAINT IF EXISTS "sms_conversations_cell_id_fkey";

-- Add the constraint back with CASCADE delete
ALTER TABLE "sms_conversations"
ADD CONSTRAINT "sms_conversations_cell_id_fkey" 
FOREIGN KEY ("cell_id") 
REFERENCES "cells"("id") 
ON DELETE CASCADE;

-- Add CASCADE delete to phone_user_mappings.cell_id foreign key
-- First, drop the existing constraint
ALTER TABLE "phone_user_mappings" 
DROP CONSTRAINT IF EXISTS "phone_user_mappings_cell_id_fkey";

-- Add the constraint back with CASCADE delete
ALTER TABLE "phone_user_mappings"
ADD CONSTRAINT "phone_user_mappings_cell_id_fkey" 
FOREIGN KEY ("cell_id") 
REFERENCES "cells"("id") 
ON DELETE CASCADE;

