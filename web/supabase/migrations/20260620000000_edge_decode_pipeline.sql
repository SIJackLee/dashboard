-- Edge Function decode pipeline: raw → iot_room_state_decoded → v_iot_decoded_latest
-- Writer: decode-batch Edge (service_role) | Reader: dashboard via View + RLS

-- ---------------------------------------------------------------------------
-- 1. Config + cursor (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.iot_decode_config (
  id           int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cron_secret  text NOT NULL,
  batch_limit  int  NOT NULL DEFAULT 100 CHECK (batch_limit > 0 AND batch_limit <= 500),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.iot_decode_config IS
  'Edge decode-batch settings. cron_secret authorizes pg_cron → Edge calls.';

INSERT INTO public.iot_decode_config (id, cron_secret, batch_limit)
VALUES (1, encode(gen_random_bytes(32), 'hex'), 100)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.iot_decode_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.iot_decode_cursor (
  id           int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_raw_id  bigint NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.iot_decode_cursor IS
  'Incremental decode progress — last processed iot_room_state_raw.id.';

INSERT INTO public.iot_decode_cursor (id, last_raw_id)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.iot_decode_cursor ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Decoded store (v0x0C row-stream)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.iot_room_state_decoded (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  raw_id            bigint NOT NULL
                    REFERENCES public.iot_room_state_raw (id) ON DELETE CASCADE,
  lsind_regist_no   text NOT NULL,
  item_code         text NOT NULL,
  module_uid        smallint NOT NULL,
  topic             text,
  wire_ver          smallint NOT NULL,
  packet_mode       text NOT NULL DEFAULT 'live'
                    CHECK (packet_mode IN ('live', 'history', 'replay')),
  history           boolean NOT NULL DEFAULT false,
  session_id        bigint,
  chunk_seq         smallint,
  lut_ver           smallint,
  controller_key    text NOT NULL,
  eqpmn_no          text NOT NULL,
  stall_ty_code     text NOT NULL,
  stall_no          text NOT NULL,
  mesure_dt         text NOT NULL,
  mesure_at         timestamptz NOT NULL,
  run_mode          smallint,
  temp_c            numeric(4, 1),
  humidity_pct      numeric(4, 1),
  decoded_json      jsonb NOT NULL,
  crc_ok            boolean,
  decode_status     text NOT NULL DEFAULT 'ok'
                    CHECK (decode_status IN ('ok', 'skipped', 'failed')),
  decode_error      text,
  decode_source     text NOT NULL DEFAULT 'edge'
                    CHECK (decode_source IN ('edge', 'backfill', 'manual')),
  received_at       timestamptz NOT NULL,
  decoded_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_iot_decoded_raw_id UNIQUE (raw_id)
);

COMMENT ON TABLE public.iot_room_state_decoded IS
  'Edge-decoded v0x0C uplink — 1 raw row → 1 controller row.';

COMMENT ON COLUMN public.iot_room_state_decoded.decoded_json IS
  'DecodedV0cPayload + schema_version v0c-1.';

CREATE INDEX IF NOT EXISTS idx_iot_decoded_live_latest
  ON public.iot_room_state_decoded (
    lsind_regist_no,
    item_code,
    module_uid,
    controller_key,
    received_at DESC
  )
  WHERE packet_mode = 'live' AND decode_status = 'ok';

CREATE INDEX IF NOT EXISTS idx_iot_decoded_farm_received
  ON public.iot_room_state_decoded (
    lsind_regist_no,
    item_code,
    module_uid,
    received_at DESC
  );

CREATE INDEX IF NOT EXISTS idx_iot_decoded_mesure_at
  ON public.iot_room_state_decoded (
    lsind_regist_no,
    item_code,
    module_uid,
    mesure_at DESC
  );

CREATE OR REPLACE FUNCTION public.sync_decoded_mesure_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.mesure_dt IS NOT NULL AND NEW.mesure_dt ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$' THEN
    NEW.mesure_at := public.parse_kst_timestamp(NEW.mesure_dt);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_iot_decoded_mesure_at ON public.iot_room_state_decoded;

CREATE TRIGGER trg_iot_decoded_mesure_at
BEFORE INSERT OR UPDATE OF mesure_dt
ON public.iot_room_state_decoded
FOR EACH ROW
EXECUTE FUNCTION public.sync_decoded_mesure_at();

-- ---------------------------------------------------------------------------
-- 3. Decode failures (optional retry / ops)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.iot_room_state_decode_failed (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  raw_id       bigint NOT NULL REFERENCES public.iot_room_state_raw (id) ON DELETE CASCADE,
  wire_ver     smallint,
  error_code   text NOT NULL,
  error_detail text,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_decode_failed_raw UNIQUE (raw_id)
);

COMMENT ON TABLE public.iot_room_state_decode_failed IS
  'Edge decode failures for ops retry.';

ALTER TABLE public.iot_room_state_decode_failed ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. Latest view (dashboard primary read path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_iot_decoded_latest
WITH (security_invoker = true) AS
SELECT DISTINCT ON (
  d.lsind_regist_no,
  d.item_code,
  d.module_uid,
  d.controller_key
)
  d.id,
  d.raw_id,
  d.lsind_regist_no,
  d.item_code,
  d.module_uid,
  d.controller_key,
  d.eqpmn_no,
  d.stall_ty_code,
  d.stall_no,
  d.wire_ver,
  d.packet_mode,
  d.run_mode,
  d.temp_c,
  d.humidity_pct,
  d.mesure_dt,
  d.mesure_at,
  d.decoded_json,
  d.received_at,
  d.decoded_at
FROM public.iot_room_state_decoded d
WHERE d.packet_mode = 'live'
  AND d.decode_status = 'ok'
  AND d.wire_ver = 12
ORDER BY
  d.lsind_regist_no,
  d.item_code,
  d.module_uid,
  d.controller_key,
  d.received_at DESC;

COMMENT ON VIEW public.v_iot_decoded_latest IS
  'LIVE controller latest from Edge-decoded table (v0x0C).';

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.iot_room_state_decoded ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decoded_select_scoped ON public.iot_room_state_decoded;

CREATE POLICY decoded_select_scoped ON public.iot_room_state_decoded
  FOR SELECT TO authenticated
  USING (
    public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  );

GRANT SELECT ON public.iot_room_state_decoded TO authenticated;
GRANT SELECT ON public.v_iot_decoded_latest TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. pg_cron → decode-batch Edge (10s)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'decode-batch-10s';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'decode-batch-10s',
  '10 seconds',
  $$
  SELECT net.http_post(
    url := 'https://ompufmezugftzoergdbn.supabase.co/functions/v1/decode-batch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT cron_secret FROM public.iot_decode_config WHERE id = 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
