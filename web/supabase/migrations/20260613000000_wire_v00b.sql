-- Wire ver=0x0B: session_id chunk merge, lut_ver optional, channel thermo commands

-- ---------------------------------------------------------------------------
-- 1. iot_room_state_raw / decoded — session_id
-- ---------------------------------------------------------------------------
ALTER TABLE public.iot_room_state_raw
  ADD COLUMN IF NOT EXISTS session_id bigint;

ALTER TABLE public.iot_room_state_decoded
  ADD COLUMN IF NOT EXISTS session_id bigint;

COMMENT ON COLUMN public.iot_room_state_raw.session_id IS
  'v0x0B publish burst id (all chunks share same session_id)';

COMMENT ON COLUMN public.iot_room_state_decoded.session_id IS
  'v0x0B burst id for LIVE multi-chunk merge';

CREATE INDEX IF NOT EXISTS idx_iot_raw_session
  ON public.iot_room_state_raw (
    lsind_regist_no,
    item_code,
    module_uid,
    session_id,
    chunk_seq
  )
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_iot_decoded_session
  ON public.iot_room_state_decoded (
    lsind_regist_no,
    item_code,
    module_uid,
    session_id,
    chunk_seq
  )
  WHERE session_id IS NOT NULL;

-- v0x0B has no lut_ver on wire; keep column for legacy rows
ALTER TABLE public.iot_room_state_raw
  ALTER COLUMN lut_ver DROP NOT NULL;

ALTER TABLE public.iot_room_state_decoded
  ALTER COLUMN lut_ver DROP NOT NULL;

COMMENT ON COLUMN public.iot_room_state_raw.lut_ver IS
  'Legacy v0x02~0x0A only; NULL for ver=0x0B';

COMMENT ON COLUMN public.iot_room_state_decoded.lut_ver IS
  'Legacy v0x02~0x0A only; NULL for ver=0x0B';

-- v0x0B: packet-level mesure_dt optional (row row_t is authoritative)
ALTER TABLE public.iot_room_state_decoded
  ALTER COLUMN mesure_dt DROP NOT NULL;

COMMENT ON COLUMN public.iot_room_state_decoded.mesure_dt IS
  'Header/batch mesure (legacy). v0x0B: prefer decoded_json.controllers[].mesureDt';

-- mode: allow history (v0x0B flags.history)
COMMENT ON COLUMN public.iot_room_state_decoded.mode IS
  'wire packet mode: live | replay | history';

-- ---------------------------------------------------------------------------
-- 2. ctrl_thermo_command — channel + eqpmn_code (SET_CHANNEL_THERMO)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ctrl_thermo_command
  ADD COLUMN IF NOT EXISTS channel text;

ALTER TABLE public.ctrl_thermo_command
  ADD COLUMN IF NOT EXISTS eqpmn_code text;

ALTER TABLE public.ctrl_thermo_command
  DROP CONSTRAINT IF EXISTS ctrl_thermo_command_action_check;

ALTER TABLE public.ctrl_thermo_command
  ADD CONSTRAINT ctrl_thermo_command_action_check
  CHECK (action IN ('SET_CTRL_THERMO', 'SET_CHANNEL_THERMO'));

ALTER TABLE public.ctrl_thermo_command
  DROP CONSTRAINT IF EXISTS ctrl_thermo_command_channel_check;

ALTER TABLE public.ctrl_thermo_command
  ADD CONSTRAINT ctrl_thermo_command_channel_check
  CHECK (
    channel IS NULL
    OR channel IN ('A', 'B', 'C')
  );

COMMENT ON COLUMN public.ctrl_thermo_command.channel IS
  'v0x0B channel slot A/B/C for SET_CHANNEL_THERMO';

COMMENT ON COLUMN public.ctrl_thermo_command.eqpmn_code IS
  'v0x0B target eqpmnCode (EC01/EC02/EC03) — must match comm module NVM';

-- ---------------------------------------------------------------------------
-- 3. Views — session_id, history mode, channels[]
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
  d.session_id,
  COALESCE(d.mode, d.decoded_json->>'mode', 'live') AS packet_mode,
  COALESCE(d.chunk_seq, (d.decoded_json->>'chunk_seq')::smallint, 0) AS chunk_seq,
  (d.decoded_json->>'partial')::boolean     AS partial,
  (d.decoded_json->>'last_chunk')::boolean  AS last_chunk,
  COALESCE(
    (d.decoded_json->>'history')::boolean,
    COALESCE(d.mode, d.decoded_json->>'mode', 'live') = 'history'
  ) AS history,
  d.decoded_json->>'schema_version'           AS schema_version,
  d.mesure_dt                                 AS header_mesure_dt,
  d.mesure_at                                 AS header_mesure_at,
  jsonb_array_length(COALESCE(d.decoded_json->'controllers', '[]'::jsonb)) AS ctrl_count,
  (
    SELECT MIN((c->>'idx')::int)
    FROM jsonb_array_elements(d.decoded_json->'controllers') c
    WHERE c ? 'idx'
  ) AS idx_min,
  (
    SELECT MAX((c->>'idx')::int)
    FROM jsonb_array_elements(d.decoded_json->'controllers') c
    WHERE c ? 'idx'
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
WHERE packet_mode IN ('replay', 'history');

CREATE VIEW public.v_iot_decoded_controllers AS
SELECT
  d.id              AS decoded_id,
  d.raw_id,
  d.lsind_regist_no,
  d.item_code,
  d.module_uid,
  d.session_id,
  COALESCE(d.mode, d.decoded_json->>'mode', 'live') AS packet_mode,
  COALESCE(d.chunk_seq, (d.decoded_json->>'chunk_seq')::smallint, 0) AS chunk_seq,
  d.wire_ver,
  d.received_at,
  (d.received_at AT TIME ZONE 'Asia/Seoul') AS received_at_kst,
  d.decoded_at,
  (d.decoded_at AT TIME ZONE 'Asia/Seoul') AS decoded_at_kst,
  (c->>'idx')::int                    AS idx,
  c->>'controllerKey'                 AS controller_key,
  c->>'eqpmnNo'                       AS eqpmn_no,
  c->>'stallNo'                       AS stall_no,
  c->>'stallTyCode'                   AS stall_ty_code,
  c->>'chMask'                        AS ch_mask,
  COALESCE(c->>'mode', d.mode, 'live') AS ctrl_mode,
  COALESCE(c->>'mesureDt', d.mesure_dt) AS mesure_dt,
  COALESCE(
    public.parse_kst_timestamp(c->>'mesureDt'),
    d.mesure_at
  ) AS mesure_at,
  c->'channels' AS channels,
  c->'ES01' AS es01,
  c->'ES02' AS es02,
  c->'EC01' AS ec01,
  c->'EC02' AS ec02,
  c->'EC03' AS ec03,
  c->'thermo' AS thermo
FROM public.iot_room_state_decoded d
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(d.decoded_json->'controllers', '[]'::jsonb)
) AS c;

CREATE VIEW public.v_iot_replay_controllers AS
SELECT *
FROM public.v_iot_decoded_controllers
WHERE packet_mode IN ('replay', 'history');

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

GRANT SELECT ON public.v_iot_decoded_packets TO authenticated;
GRANT SELECT ON public.v_iot_replay_packets TO authenticated;
GRANT SELECT ON public.v_iot_decoded_controllers TO authenticated;
GRANT SELECT ON public.v_iot_replay_controllers TO authenticated;
GRANT SELECT ON public.v_iot_replay_burst_summary TO authenticated;
