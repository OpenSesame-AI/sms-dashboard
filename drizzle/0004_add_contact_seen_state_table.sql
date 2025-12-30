-- Create contact_seen_state table to track when contacts have been viewed
CREATE TABLE IF NOT EXISTS contact_seen_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  phone_number varchar NOT NULL,
  cell_id uuid REFERENCES cells(id) ON DELETE CASCADE,
  last_seen_activity timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT contact_seen_state_phone_cell_unique UNIQUE(phone_number, cell_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_contact_seen_state_phone_cell ON contact_seen_state(phone_number, cell_id);

