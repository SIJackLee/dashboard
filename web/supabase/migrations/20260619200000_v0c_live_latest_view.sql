-- v0x0C only: 1 MQTT packet = 1 controller → DISTINCT ON latest received_at.
-- Replaces iot_live_ctrl_snapshot + live_snapshot.py worker.

DROP VIEW IF EXISTS public.v_iot_live_latest;

DROP TABLE IF EXISTS public.iot_live_ctrl_snapshot;

CREATE OR REPLACE FUNCTION public.iot_v0c_controller_key(p_payload bytea)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT
    'SP' || lpad(get_byte(p_payload, 6)::text, 2, '0')
    || ':'
    || lpad(get_byte(p_payload, 7)::text, 2, '0')
    || ':'
    || lpad(get_byte(p_payload, 8)::text, 2, '0');
$$;

COMMENT ON FUNCTION public.iot_v0c_controller_key IS
  'v0x0C slim row — stallTy/stallNo/eqpmnNo at payload bytes 6–8';

CREATE OR REPLACE VIEW public.v_iot_live_latest AS
SELECT DISTINCT ON (
  r.lsind_regist_no,
  r.item_code,
  r.module_uid,
  public.iot_v0c_controller_key(r.payload_bytea)
)
  r.id AS raw_id,
  r.lsind_regist_no,
  r.item_code,
  r.module_uid,
  public.iot_v0c_controller_key(r.payload_bytea) AS controller_key,
  get_byte(r.payload_bytea, 0)::smallint AS wire_ver,
  CASE
    WHEN (get_byte(r.payload_bytea, 1) & 1) = 0 THEN 'live'
    ELSE 'history'
  END AS packet_mode,
  r.payload_bytea,
  r.received_at,
  r.topic
FROM public.iot_room_state_raw r
WHERE r.payload_bytea IS NOT NULL
  AND length(r.payload_bytea) >= 79
  AND get_byte(r.payload_bytea, 0) = 12
  AND (get_byte(r.payload_bytea, 1) & 1) = 0
ORDER BY
  r.lsind_regist_no,
  r.item_code,
  r.module_uid,
  public.iot_v0c_controller_key(r.payload_bytea),
  r.received_at DESC;

COMMENT ON VIEW public.v_iot_live_latest IS
  'v0x0C LIVE — newest raw row per controller_key (no snapshot table)';

GRANT SELECT ON public.v_iot_live_latest TO authenticated;
