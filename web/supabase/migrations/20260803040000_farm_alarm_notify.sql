-- farm_alarm_notify: Notify Worker (N.py) queue for SOLAPI SMS/VOICE
-- Applied via Supabase MCP on iot-cloud (ompufmezugftzoergdbn) 2026-08-03

CREATE TABLE IF NOT EXISTS public.farm_alarm_notify (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lsind_regist_no text,
  phone text NOT NULL,
  channel text NOT NULL DEFAULT 'sms'
    CHECK (channel IN ('sms', 'voice', 'both', 'ars')),
  sms_text text,
  voice_text text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempt_count int NOT NULL DEFAULT 0,
  provider_ref text,
  last_error text,
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS farm_alarm_notify_pending_idx
  ON public.farm_alarm_notify (created_at asc)
  WHERE status = 'pending';

ALTER TABLE public.farm_alarm_notify ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.farm_alarm_notify IS
  'Alarm notify queue for N.py → SOLAPI SMS/VOICE';
