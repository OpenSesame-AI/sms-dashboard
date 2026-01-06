-- Create ai_alerts table for alert definitions
CREATE TABLE IF NOT EXISTS ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name varchar NOT NULL,
  type varchar NOT NULL CHECK (type IN ('ai', 'keyword')),
  condition text NOT NULL,
  cell_id uuid REFERENCES cells(id) ON DELETE CASCADE,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create ai_alert_triggers table for triggered alert instances
CREATE TABLE IF NOT EXISTS ai_alert_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  alert_id uuid NOT NULL REFERENCES ai_alerts(id) ON DELETE CASCADE,
  phone_number varchar NOT NULL,
  cell_id uuid REFERENCES cells(id) ON DELETE CASCADE,
  message_id uuid REFERENCES sms_conversations(id) ON DELETE CASCADE,
  triggered_at timestamp with time zone DEFAULT now() NOT NULL,
  dismissed boolean DEFAULT false NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_alerts_cell_id ON ai_alerts(cell_id);
CREATE INDEX IF NOT EXISTS idx_ai_alerts_enabled ON ai_alerts(enabled);
CREATE INDEX IF NOT EXISTS idx_ai_alert_triggers_alert_id ON ai_alert_triggers(alert_id);
CREATE INDEX IF NOT EXISTS idx_ai_alert_triggers_phone_cell ON ai_alert_triggers(phone_number, cell_id);
CREATE INDEX IF NOT EXISTS idx_ai_alert_triggers_dismissed ON ai_alert_triggers(dismissed);
CREATE INDEX IF NOT EXISTS idx_ai_alert_triggers_message_id ON ai_alert_triggers(message_id);


