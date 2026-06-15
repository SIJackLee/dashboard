-- v0x06 LIVE/REPLAY: decoded 컬럼 보강 + 조회 view

ALTER TABLE public.iot_room_state_decoded
  ADD COLUMN IF NOT EXISTS mode text;

ALTER TABLE public.iot_room_state_decoded
  ADD COLUMN IF NOT EXISTS chunk_seq smallint;

COMMENT ON COLUMN public.iot_room_state_decoded.mode IS 'wire packet mode: live | replay';
COMMENT ON COLUMN public.iot_room_state_decoded.chunk_seq IS 'v0x06 REPLAY burst chunk sequence (LIVE=0)';

-- 레거시 행 backfill
UPDATE public.iot_room_state_decoded
SET mode = COALESCE(mode, decoded_json->>'mode', 'live')
WHERE mode IS NULL;

UPDATE public.iot_room_state_decoded
SET chunk_seq = COALESCE(
  chunk_seq,
  (decoded_json->>'chunk_seq')::smallint,
  0
)
WHERE chunk_seq IS NULL;

CREATE OR REPLACE VIEW public.v_iot_decoded_packets AS
SELECT
  d.id,
  d.raw_id,
  d.farm_uid,
  d.module_uid,
  d.wire_ver,
  d.lut_ver,
  COALESCE(d.mode, d.decoded_json->>'mode', 'live') AS packet_mode,
  COALESCE(d.chunk_seq, (d.decoded_json->>'chunk_seq')::smallint, 0) AS chunk_seq,
  (d.decoded_json->>'partial')::boolean     AS partial,
  (d.decoded_json->>'last_chunk')::boolean  AS last_chunk,
  d.decoded_json->>'schema_version'           AS schema_version,
  d.mesure_dt                                 AS header_mesure_dt,
  jsonb_array_length(COALESCE(d.decoded_json->'controllers', '[]'::jsonb)) AS ctrl_count,
  (
    SELECT MIN((c->>'idx')::int)
    FROM jsonb_array_elements(d.decoded_json->'controllers') c
  ) AS idx_min,
  (
    SELECT MAX((c->>'idx')::int)
    FROM jsonb_array_elements(d.decoded_json->'controllers') c
  ) AS idx_max,
  d.crc_ok,
  d.received_at,
  d.decoded_at
FROM public.iot_room_state_decoded d;

CREATE OR REPLACE VIEW public.v_iot_replay_packets AS
SELECT *
FROM public.v_iot_decoded_packets
WHERE packet_mode = 'replay';

CREATE OR REPLACE VIEW public.v_iot_decoded_controllers AS
SELECT
  d.id              AS decoded_id,
  d.raw_id,
  d.farm_uid,
  d.module_uid,
  COALESCE(d.mode, d.decoded_json->>'mode', 'live') AS packet_mode,
  COALESCE(d.chunk_seq, (d.decoded_json->>'chunk_seq')::smallint, 0) AS chunk_seq,
  d.wire_ver,
  d.received_at,
  d.decoded_at,
  (c->>'idx')::int                    AS idx,
  c->>'eqpmnNo'                       AS eqpmn_no,
  c->>'stallNo'                       AS stall_no,
  c->>'stallTyCode'                   AS stall_ty_code,
  COALESCE(c->>'mode', d.mode, 'live') AS ctrl_mode,
  COALESCE(c->>'mesureDt', d.mesure_dt) AS mesure_dt,
  c->'ES01' AS es01,
  c->'ES02' AS es02,
  c->'EC01' AS ec01,
  c->'EC02' AS ec02,
  c->'EC03' AS ec03
FROM public.iot_room_state_decoded d
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(d.decoded_json->'controllers', '[]'::jsonb)
) AS c;

CREATE OR REPLACE VIEW public.v_iot_replay_controllers AS
SELECT *
FROM public.v_iot_decoded_controllers
WHERE packet_mode = 'replay';

CREATE OR REPLACE VIEW public.v_iot_replay_burst_summary AS
WITH replay AS (
  SELECT
    *,
    SUM(CASE WHEN chunk_seq = 0 THEN 1 ELSE 0 END)
      OVER (PARTITION BY farm_uid, module_uid ORDER BY received_at, id)
      AS burst_no
  FROM public.v_iot_replay_packets
)
SELECT
  farm_uid,
  module_uid,
  burst_no,
  MIN(received_at)  AS burst_started_at,
  MAX(received_at)  AS burst_ended_at,
  COUNT(*)          AS packet_count,
  MAX(chunk_seq)    AS max_chunk_seq,
  BOOL_OR(last_chunk) AS has_last_chunk,
  SUM(ctrl_count)   AS total_ctrl_rows,
  MIN(idx_min)      AS idx_min,
  MAX(idx_max)      AS idx_max
FROM replay
GROUP BY farm_uid, module_uid, burst_no;

GRANT SELECT ON public.v_iot_decoded_packets TO authenticated;
GRANT SELECT ON public.v_iot_replay_packets TO authenticated;
GRANT SELECT ON public.v_iot_decoded_controllers TO authenticated;
GRANT SELECT ON public.v_iot_replay_controllers TO authenticated;
GRANT SELECT ON public.v_iot_replay_burst_summary TO authenticated;
