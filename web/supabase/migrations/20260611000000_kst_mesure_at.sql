-- KST 기준 측정 시각 timestamptz (mesure_at) + view 갱신
-- mesure_dt(text)는 KST wall-clock 문자열(YYYY-MM-DD HH:MM:SS) 유지
-- mesure_at은 해당 순간을 timestamptz로 저장하여 시계열 정렬·조회에 사용

-- ---------------------------------------------------------------------------
-- 1. KST 문자열 → timestamptz
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.parse_kst_timestamp(txt text)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT (btrim(txt)::timestamp AT TIME ZONE 'Asia/Seoul');
$$;

COMMENT ON FUNCTION public.parse_kst_timestamp(text) IS
  'KST wall-clock 문자열(YYYY-MM-DD HH:MM:SS)을 timestamptz로 변환';

-- ---------------------------------------------------------------------------
-- 2. iot_room_state_decoded.mesure_at
-- ---------------------------------------------------------------------------
ALTER TABLE public.iot_room_state_decoded
  ADD COLUMN IF NOT EXISTS mesure_at timestamptz;

UPDATE public.iot_room_state_decoded
SET mesure_at = public.parse_kst_timestamp(mesure_dt)
WHERE mesure_at IS NULL
  AND mesure_dt IS NOT NULL
  AND mesure_dt ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$';

CREATE OR REPLACE FUNCTION public.sync_decoded_mesure_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.mesure_at := public.parse_kst_timestamp(NEW.mesure_dt);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_iot_decoded_mesure_at ON public.iot_room_state_decoded;

CREATE TRIGGER trg_iot_decoded_mesure_at
BEFORE INSERT OR UPDATE OF mesure_dt
ON public.iot_room_state_decoded
FOR EACH ROW
EXECUTE FUNCTION public.sync_decoded_mesure_at();

CREATE INDEX IF NOT EXISTS idx_iot_decoded_mesure_at
  ON public.iot_room_state_decoded (
    lsind_regist_no,
    item_code,
    module_uid,
    mesure_at DESC
  );

COMMENT ON COLUMN public.iot_room_state_decoded.mesure_at IS
  '측정 시각 (KST wall-clock mesure_dt → timestamptz, 시계열 정렬용)';

-- ---------------------------------------------------------------------------
-- 3. Views — mesure_at / received_at_kst 노출
-- (컬럼 구조 변경 시 CREATE OR REPLACE 불가 → DROP 후 재생성)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_iot_replay_burst_summary;
DROP VIEW IF EXISTS public.v_iot_replay_controllers;
DROP VIEW IF EXISTS public.v_iot_replay_packets;
DROP VIEW IF EXISTS public.v_iot_decoded_controllers;
DROP VIEW IF EXISTS public.v_iot_decoded_packets;

CREATE VIEW public.v_iot_decoded_packets AS
SELECT
  d.id,
  d.raw_id,
  d.lsind_regist_no,
  d.item_code,
  d.module_uid,
  d.wire_ver,
  d.lut_ver,
  COALESCE(d.mode, d.decoded_json->>'mode', 'live') AS packet_mode,
  COALESCE(d.chunk_seq, (d.decoded_json->>'chunk_seq')::smallint, 0) AS chunk_seq,
  (d.decoded_json->>'partial')::boolean     AS partial,
  (d.decoded_json->>'last_chunk')::boolean  AS last_chunk,
  d.decoded_json->>'schema_version'           AS schema_version,
  d.mesure_dt                                 AS header_mesure_dt,
  d.mesure_at                                 AS header_mesure_at,
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
  (d.received_at AT TIME ZONE 'Asia/Seoul') AS received_at_kst,
  d.decoded_at,
  (d.decoded_at AT TIME ZONE 'Asia/Seoul') AS decoded_at_kst
FROM public.iot_room_state_decoded d;

CREATE VIEW public.v_iot_replay_packets AS
SELECT *
FROM public.v_iot_decoded_packets
WHERE packet_mode = 'replay';

CREATE VIEW public.v_iot_decoded_controllers AS
SELECT
  d.id              AS decoded_id,
  d.raw_id,
  d.lsind_regist_no,
  d.item_code,
  d.module_uid,
  COALESCE(d.mode, d.decoded_json->>'mode', 'live') AS packet_mode,
  COALESCE(d.chunk_seq, (d.decoded_json->>'chunk_seq')::smallint, 0) AS chunk_seq,
  d.wire_ver,
  d.received_at,
  (d.received_at AT TIME ZONE 'Asia/Seoul') AS received_at_kst,
  d.decoded_at,
  (d.decoded_at AT TIME ZONE 'Asia/Seoul') AS decoded_at_kst,
  (c->>'idx')::int                    AS idx,
  c->>'eqpmnNo'                       AS eqpmn_no,
  c->>'stallNo'                       AS stall_no,
  c->>'stallTyCode'                   AS stall_ty_code,
  COALESCE(c->>'mode', d.mode, 'live') AS ctrl_mode,
  COALESCE(c->>'mesureDt', d.mesure_dt) AS mesure_dt,
  COALESCE(
    public.parse_kst_timestamp(c->>'mesureDt'),
    d.mesure_at
  ) AS mesure_at,
  c->'ES01' AS es01,
  c->'ES02' AS es02,
  c->'EC01' AS ec01,
  c->'EC02' AS ec02,
  c->'EC03' AS ec03
FROM public.iot_room_state_decoded d
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(d.decoded_json->'controllers', '[]'::jsonb)
) AS c;

CREATE VIEW public.v_iot_replay_controllers AS
SELECT *
FROM public.v_iot_decoded_controllers
WHERE packet_mode = 'replay';

CREATE VIEW public.v_iot_replay_burst_summary AS
WITH replay AS (
  SELECT
    *,
    SUM(CASE WHEN chunk_seq = 0 THEN 1 ELSE 0 END)
      OVER (
        PARTITION BY lsind_regist_no, item_code, module_uid
        ORDER BY received_at, id
      )
      AS burst_no
  FROM public.v_iot_replay_packets
)
SELECT
  lsind_regist_no,
  item_code,
  module_uid,
  burst_no,
  MIN(received_at)  AS burst_started_at,
  MAX(received_at)  AS burst_ended_at,
  MIN(received_at_kst) AS burst_started_at_kst,
  MAX(received_at_kst) AS burst_ended_at_kst,
  COUNT(*)          AS packet_count,
  MAX(chunk_seq)    AS max_chunk_seq,
  BOOL_OR(last_chunk) AS has_last_chunk,
  SUM(ctrl_count)   AS total_ctrl_rows,
  MIN(idx_min)      AS idx_min,
  MAX(idx_max)      AS idx_max
FROM replay
GROUP BY lsind_regist_no, item_code, module_uid, burst_no;
