-- LIVE hot views: latest-per-controller without scanning full live history.
-- v_iot_farm_overview DISTINCT ON all live rows (~128k) exceeded statement timeout (~8s).
--
-- Key discovery: controllers with a live ok v12 row in the last 2 hours.
-- Latest row: LATERAL LIMIT 1 on (farm, module, controller, received_at DESC).
-- Offline threshold remains 1 hour. Controllers silent > 2 hours leave the list.
-- Rollback: recreate views from 20260805193000_iot_decoded_drop_decoded_at.sql.

DROP VIEW IF EXISTS public.v_iot_farm_overview;
DROP VIEW IF EXISTS public.v_iot_dashboard_list;
DROP VIEW IF EXISTS public.v_iot_decoded_latest;

CREATE VIEW public.v_iot_decoded_latest AS
SELECT
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
  d.received_at
FROM (
  SELECT DISTINCT lsind_regist_no, item_code, module_uid, controller_key
  FROM public.iot_room_state_decoded
  WHERE packet_mode = 'live'
    AND decode_status = 'ok'
    AND wire_ver = 12
    AND received_at > (now() - '02:00:00'::interval)
) k
CROSS JOIN LATERAL (
  SELECT
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
  WHERE d.lsind_regist_no = k.lsind_regist_no
    AND d.item_code = k.item_code
    AND d.module_uid = k.module_uid
    AND d.controller_key = k.controller_key
    AND d.packet_mode = 'live'
    AND d.decode_status = 'ok'
    AND d.wire_ver = 12
  ORDER BY d.received_at DESC
  LIMIT 1
) d;

CREATE VIEW public.v_iot_dashboard_list AS
SELECT
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
  d.setpoint_temp,
  d.temp_deviation,
  d.min_vent_pct,
  d.max_vent_pct
FROM (
  SELECT DISTINCT lsind_regist_no, item_code, module_uid, controller_key
  FROM public.iot_room_state_decoded
  WHERE packet_mode = 'live'
    AND decode_status = 'ok'
    AND wire_ver = 12
    AND received_at > (now() - '02:00:00'::interval)
) k
CROSS JOIN LATERAL (
  SELECT
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
  WHERE d.lsind_regist_no = k.lsind_regist_no
    AND d.item_code = k.item_code
    AND d.module_uid = k.module_uid
    AND d.controller_key = k.controller_key
    AND d.packet_mode = 'live'
    AND d.decode_status = 'ok'
    AND d.wire_ver = 12
  ORDER BY d.received_at DESC
  LIMIT 1
) d;

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

COMMENT ON VIEW public.v_iot_decoded_latest IS
  'LIVE latest per controller. Keys from last 2 hours, then LATERAL latest row.';
COMMENT ON VIEW public.v_iot_dashboard_list IS
  'LIVE list tier. Keys from last 2 hours, then LATERAL latest row. Flat columns only.';
COMMENT ON VIEW public.v_iot_farm_overview IS
  'Farm aggregates from v_iot_dashboard_list. Do not scan full live history.';

GRANT SELECT ON public.v_iot_decoded_latest TO anon, authenticated, service_role;
GRANT SELECT ON public.v_iot_dashboard_list TO anon, authenticated, service_role;
GRANT SELECT ON public.v_iot_farm_overview TO anon, authenticated, service_role;
