-- List tier: channel A thermo flat fields for gauge setpoint band (no full decoded_json to client)

CREATE OR REPLACE FUNCTION public.extract_channel_a_thermo(channels jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ch -> 'thermo'
  FROM jsonb_array_elements(COALESCE(channels, '[]'::jsonb)) AS ch
  WHERE ch ->> 'channel' = 'A'
    AND jsonb_typeof(ch -> 'thermo') = 'object'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.extract_channel_a_thermo(jsonb) IS
  'LIVE decoded channels[] — channel A thermo object for list-tier gauge band.';

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
  d.decoded_at,
  NULLIF(public.extract_channel_a_thermo(d.decoded_json -> 'channels') ->> 'setpointTemp', '')::numeric
    AS setpoint_temp,
  NULLIF(public.extract_channel_a_thermo(d.decoded_json -> 'channels') ->> 'tempDeviation', '')::numeric
    AS temp_deviation,
  (public.extract_channel_a_thermo(d.decoded_json -> 'channels') ->> 'minVentPct')::numeric
    AS min_vent_pct,
  (public.extract_channel_a_thermo(d.decoded_json -> 'channels') ->> 'maxVentPct')::numeric
    AS max_vent_pct
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
  'LIVE list tier — flat env + fan + channel-A thermo (setpoint band), no decoded_json payload.';
