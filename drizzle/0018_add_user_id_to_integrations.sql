-- Add user_id and organization_id columns to integrations table
-- Make cell_id nullable to support global integrations

-- First, make cell_id nullable
ALTER TABLE "integrations" 
  ALTER COLUMN "cell_id" DROP NOT NULL;

-- Add user_id column (nullable first, will be populated and made NOT NULL in script)
ALTER TABLE "integrations" 
  ADD COLUMN IF NOT EXISTS "user_id" varchar;

-- Add organization_id column (nullable)
ALTER TABLE "integrations" 
  ADD COLUMN IF NOT EXISTS "organization_id" varchar;

-- Drop the old unique constraint that required cell_id
ALTER TABLE "integrations" 
  DROP CONSTRAINT IF EXISTS "integrations_cell_id_type_unique";

-- Add new unique constraint for per-cell integrations (cell_id is not null)
-- Note: We can't create a partial unique index directly in ALTER TABLE, so we'll do it separately
CREATE UNIQUE INDEX IF NOT EXISTS "integrations_cell_id_type_unique" 
  ON "integrations" ("cell_id", "type") 
  WHERE "cell_id" IS NOT NULL;
