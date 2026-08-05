-- Sparse PoC: last absolute metrics per controller series + decode config flags
-- Applied for FARM01/P00 PoC (see DECODED_ROWCOUNT_PLAN.md)

ALTER TABLE public.iot_decode_config
  ADD COLUMN IF NOT EXISTS sparse_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sparse_farm_keys text[] NOT NULL DEFAULT ARRAY['FARM01/P00']::text[],
  ADD COLUMN IF NOT EXISTS sparse_eps_temp numeric NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS sparse_eps_fan numeric NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS sparse_heartbeat_sec integer NOT NULL DEFAULT 1800;

COMMENT ON COLUMN public.iot_decode_config.sparse_enabled IS
  'When true, decode-batch may skip decoded upsert if metrics within eps and heartbeat';
COMMENT ON COLUMN public.iot_decode_config.sparse_farm_keys IS
  'PoC allowlist farm keys as lsind/item (e.g. FARM01/P00). Empty = all farms when enabled.';

CREATE TABLE IF NOT EXISTS public.iot_decoded_last_value (
  lsind_regist_no text NOT NULL,
  item_code text NOT NULL,
  module_uid smallint NOT NULL,
  controller_key text NOT NULL,
  temp_c numeric(4, 1),
  fan_exhaust_pct numeric(4, 1),
  fan_intake_pct numeric(4, 1),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lsind_regist_no, item_code, module_uid, controller_key)
);

COMMENT ON TABLE public.iot_decoded_last_value IS
  'Last absolute metrics written to iot_room_state_decoded (sparse gate).';

ALTER TABLE public.iot_decoded_last_value ENABLE ROW LEVEL SECURITY;

-- service_role bypasses RLS; no authenticated policies (internal decode only)

UPDATE public.iot_decode_config
SET
  sparse_enabled = true,
  sparse_farm_keys = ARRAY['FARM01/P00']::text[],
  sparse_eps_temp = 0.2,
  sparse_eps_fan = 2,
  sparse_heartbeat_sec = 1800,
  updated_at = now()
WHERE id = 1;
