-- Create available_phone_numbers table
CREATE TABLE IF NOT EXISTS "available_phone_numbers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "phone_number" varchar NOT NULL UNIQUE,
  "created_at" timestamp with time zone DEFAULT now()
);





