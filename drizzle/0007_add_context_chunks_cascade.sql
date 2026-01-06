-- Add foreign key constraint with CASCADE delete for cell_context_chunks
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cell_context_chunks_context_id_fk'
  ) THEN
    ALTER TABLE "cell_context_chunks" ADD CONSTRAINT "cell_context_chunks_context_id_fk" 
    FOREIGN KEY ("context_id") REFERENCES "cell_context"("id") ON DELETE CASCADE;
  END IF;
END $$;


