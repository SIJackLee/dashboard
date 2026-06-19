-- Dashboard LIVE perf: flat fan columns, list/overview views

-- ---------------------------------------------------------------------------
-- 1. Flat fan columns on decoded store
-- ---------------------------------------------------------------------------
ALTER TABLE public.iot_room_state_decoded
  ADD COLUMN IF NOT EXISTS fan_supply_pct numeric(5, 1),
  ADD COLUMN IF NOT EXISTS fan_exhaust_pct numeric(5, 1),
  ADD COLUMN IF NOT EXISTS fan_intake_pct numeric(5, 1);

COMMENT ON COLUMN public.iot_room_state_decoded.fan_supply_pct IS
  'EC01 max output % — list tier flat field';
COMMENT ON COLUMN public.iot_room_state_decoded.fan_exhaust_pct IS
  'EC02 max output % — list tier flat field';
COMMENT ON COLUMN public.iot_room_state_decoded.fan_intake_pct IS
  'EC03 max output % — list tier flat field';

CREATE OR REPLACE FUNCTION public.extract_channel_fan_pct(channels jsonb, eqpmn_code text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (
    SELECT max((kv.value #>> '{}')::numeric)
    FROM jsonb_array_elements(COALESCE(channels, '[]'::jsonb)) AS ch,
         jsonb_each(ch -> 'outputs') AS kv(key, value)
    WHERE ch ->> 'eqpmnCode' = eqpmn_code
      AND (kv.value #>> '{}') ~ '^-?\d'
  );
$$;

UPDATE public.iot_room_state_decoded d
SET
  fan_supply_pct = public.extract_channel_fan_pct(d.decoded_json -> 'channels', 'EC01'),
  fan_exhaust_pct = public.extract_channel_fan_pct(d.decoded_json -> 'channels', 'EC02'),
  fan_intake_pct = public.extract_channel_fan_pct(d.decoded_json -> 'channels', 'EC03')
WHERE d.fan_supply_pct IS NULL
   OR d.fan_exhaust_pct IS NULL
   OR d.fan_intake_pct IS NULL;

-- ---------------------------------------------------------------------------
-- 2. List tier view (no decoded_json)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_iot_dashboard_list
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
  d.fan_supply_pct,
  d.fan_exhaust_pct,
  d.fan_intake_pct,
  d.mesure_dt,
  d.mesure_at,
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

COMMENT ON VIEW public.v_iot_dashboard_list IS
  'LIVE list tier — flat env + fan, no decoded_json payload.';

GRANT SELECT ON public.v_iot_dashboard_list TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Farm overview aggregate (admin /farm map)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_iot_farm_overview
WITH (security_invoker = true) AS
SELECT
  l.lsind_regist_no,
  l.item_code,
  count(*)::int AS controller_count,
  count(*) FILTER (
    WHERE l.received_at < (now() - interval '60 minutes')
  )::int AS offline_count,
  avg(l.temp_c) FILTER (WHERE l.temp_c IS NOT NULL) AS avg_temp_c,
  avg(l.humidity_pct) FILTER (WHERE l.humidity_pct IS NOT NULL) AS avg_humidity_pct,
  max(l.received_at) AS latest_received_at
FROM public.v_iot_dashboard_list l
GROUP BY l.lsind_regist_no, l.item_code;

COMMENT ON VIEW public.v_iot_farm_overview IS
  'Per-farm LIVE summary for admin overview — no per-controller row fetch.';

GRANT SELECT ON public.v_iot_farm_overview TO authenticated;
