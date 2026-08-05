-- Thermo flat columns + fat→slim decoded_json backfill.
-- List view reads flat thermo (no extract from JSON).

ALTER TABLE public.iot_room_state_decoded
  ADD COLUMN IF NOT EXISTS setpoint_temp numeric,
  ADD COLUMN IF NOT EXISTS temp_deviation numeric,
  ADD COLUMN IF NOT EXISTS min_vent_pct numeric,
  ADD COLUMN IF NOT EXISTS max_vent_pct numeric;

COMMENT ON COLUMN public.iot_room_state_decoded.setpoint_temp IS
  'Channel A thermo setpoint (°C); filled by Edge / backfill.';
COMMENT ON COLUMN public.iot_room_state_decoded.temp_deviation IS
  'Channel A thermo deviation (°C).';
COMMENT ON COLUMN public.iot_room_state_decoded.min_vent_pct IS
  'Channel A thermo min vent %.';
COMMENT ON COLUMN public.iot_room_state_decoded.max_vent_pct IS
  'Channel A thermo max vent %.';

-- Backfill thermo from channel A (or first channel with thermo)
UPDATE public.iot_room_state_decoded d
SET
  setpoint_temp = NULLIF(
    public.extract_channel_a_thermo(d.decoded_json -> 'channels') ->> 'setpointTemp',
    ''
  )::numeric,
  temp_deviation = NULLIF(
    public.extract_channel_a_thermo(d.decoded_json -> 'channels') ->> 'tempDeviation',
    ''
  )::numeric,
  min_vent_pct = (
    public.extract_channel_a_thermo(d.decoded_json -> 'channels') ->> 'minVentPct'
  )::numeric,
  max_vent_pct = (
    public.extract_channel_a_thermo(d.decoded_json -> 'channels') ->> 'maxVentPct'
  )::numeric
WHERE d.decoded_json ? 'channels'
  AND (
    d.setpoint_temp IS NULL
    AND d.temp_deviation IS NULL
    AND d.min_vent_pct IS NULL
    AND d.max_vent_pct IS NULL
  );

-- Slim fat JSON (keep channels + tempsC only)
UPDATE public.iot_room_state_decoded
SET decoded_json = jsonb_build_object(
  'schema_version', 'v0c-slim-1',
  'tempsC', COALESCE(decoded_json -> 'tempsC', '[]'::jsonb),
  'channels', COALESCE(decoded_json -> 'channels', '[]'::jsonb)
)
WHERE decoded_json->>'schema_version' IS DISTINCT FROM 'v0c-slim-1'
  AND decoded_json ? 'channels';

DROP VIEW IF EXISTS public.v_iot_farm_overview;
DROP VIEW IF EXISTS public.v_iot_dashboard_list;

CREATE VIEW public.v_iot_dashboard_list AS
SELECT DISTINCT ON (lsind_regist_no, item_code, module_uid, controller_key)
  id,
  raw_id,
  lsind_regist_no,
  item_code,
  module_uid,
  controller_key,
  eqpmn_no,
  stall_ty_code,
  stall_no,
  wire_ver,
  packet_mode,
  run_mode,
  temp_c,
  humidity_pct,
  fan_supply_pct,
  fan_exhaust_pct,
  fan_intake_pct,
  mesure_dt,
  mesure_at,
  received_at,
  decoded_at,
  setpoint_temp,
  temp_deviation,
  min_vent_pct,
  max_vent_pct
FROM public.iot_room_state_decoded d
WHERE packet_mode = 'live'
  AND decode_status = 'ok'
  AND wire_ver = 12
ORDER BY lsind_regist_no, item_code, module_uid, controller_key, received_at DESC;

CREATE VIEW public.v_iot_farm_overview AS
SELECT lsind_regist_no,
  item_code,
  count(*)::integer AS controller_count,
  count(*) FILTER (WHERE received_at < (now() - '01:00:00'::interval))::integer AS offline_count,
  avg(temp_c) FILTER (WHERE temp_c IS NOT NULL) AS avg_temp_c,
  avg(humidity_pct) FILTER (WHERE humidity_pct IS NOT NULL) AS avg_humidity_pct,
  max(received_at) AS latest_received_at
FROM v_iot_dashboard_list l
GROUP BY lsind_regist_no, item_code;

GRANT SELECT ON public.v_iot_dashboard_list TO anon, authenticated, service_role;
GRANT SELECT ON public.v_iot_farm_overview TO anon, authenticated, service_role;
