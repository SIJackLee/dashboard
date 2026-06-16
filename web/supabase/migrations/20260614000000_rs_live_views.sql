-- RS row-stream: raw LIVE view (decode in app layer; SQL decode optional follow-up)

CREATE OR REPLACE VIEW public.v_iot_raw_live AS
SELECT
  r.id,
  r.lsind_regist_no,
  r.item_code,
  r.module_uid,
  r.topic,
  r.payload_bytea,
  r.payload_json,
  r.received_at,
  r.saved_at,
  length(r.payload_bytea) AS payload_len,
  get_byte(r.payload_bytea, 0) AS wire_ver
FROM public.iot_room_state_raw r
WHERE r.payload_bytea IS NOT NULL
  AND length(r.payload_bytea) >= 14
  AND get_byte(r.payload_bytea, 0) = 11;

COMMENT ON VIEW public.v_iot_raw_live IS
  'Recent v0x0B raw uplink rows for LIVE decode (RS passthrough policy)';

GRANT SELECT ON public.v_iot_raw_live TO authenticated;
