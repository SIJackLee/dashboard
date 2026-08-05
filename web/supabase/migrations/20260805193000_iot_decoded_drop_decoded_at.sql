-- Drop ops-only decode write timestamp from decoded (UI unused).
-- Keep mesure_at (partition/trend), mesure_dt (UI text), received_at (live freshness).

DROP VIEW IF EXISTS public.v_iot_farm_overview;
DROP VIEW IF EXISTS public.v_iot_dashboard_list;
DROP VIEW IF EXISTS public.v_iot_decoded_latest;

ALTER TABLE public.iot_room_state_decoded
  DROP COLUMN IF EXISTS decoded_at;

CREATE VIEW public.v_iot_decoded_latest AS
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
  mesure_dt,
  mesure_at,
  decoded_json,
  received_at
FROM public.iot_room_state_decoded d
WHERE packet_mode = 'live'
  AND decode_status = 'ok'
  AND wire_ver = 12
ORDER BY lsind_regist_no, item_code, module_uid, controller_key, received_at DESC;

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
FROM public.v_iot_dashboard_list l
GROUP BY lsind_regist_no, item_code;

GRANT SELECT ON public.v_iot_decoded_latest TO anon, authenticated, service_role;
GRANT SELECT ON public.v_iot_dashboard_list TO anon, authenticated, service_role;
GRANT SELECT ON public.v_iot_farm_overview TO anon, authenticated, service_role;
