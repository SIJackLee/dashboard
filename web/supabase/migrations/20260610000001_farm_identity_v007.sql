-- v0x07 farm identity: farm_uid → lsind_regist_no + item_code
-- MQTT topic: sungil/{lsindRegistNo}/{itemCode}/raw

-- ---------------------------------------------------------------------------
-- 0. Drop dependent views (recreated in §6)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_iot_replay_burst_summary CASCADE;
DROP VIEW IF EXISTS public.v_iot_replay_controllers CASCADE;
DROP VIEW IF EXISTS public.v_iot_decoded_controllers CASCADE;
DROP VIEW IF EXISTS public.v_iot_replay_packets CASCADE;
DROP VIEW IF EXISTS public.v_iot_decoded_packets CASCADE;
DROP VIEW IF EXISTS public.v_iot_decoded_ctrl_flat CASCADE;

DROP POLICY IF EXISTS thermo_command_insert_scoped ON public.ctrl_thermo_command;
DROP POLICY IF EXISTS decoded_select_scoped ON public.iot_room_state_decoded;

-- ---------------------------------------------------------------------------
-- 1. iot_room_state_raw
-- ---------------------------------------------------------------------------
ALTER TABLE public.iot_room_state_raw
  ADD COLUMN IF NOT EXISTS lsind_regist_no text;

ALTER TABLE public.iot_room_state_raw
  ADD COLUMN IF NOT EXISTS item_code text;

UPDATE public.iot_room_state_raw
SET
  lsind_regist_no = COALESCE(
    lsind_regist_no,
    'FARM' || LPAD(farm_uid::text, 2, '0')
  ),
  item_code = COALESCE(item_code, 'P00')
WHERE lsind_regist_no IS NULL OR item_code IS NULL;

ALTER TABLE public.iot_room_state_raw
  ALTER COLUMN lsind_regist_no SET NOT NULL;

ALTER TABLE public.iot_room_state_raw
  ALTER COLUMN item_code SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_iot_raw_farm_module
  ON public.iot_room_state_raw (lsind_regist_no, item_code, module_uid, received_at DESC);

ALTER TABLE public.iot_room_state_raw
  DROP COLUMN IF EXISTS farm_uid;

-- ---------------------------------------------------------------------------
-- 2. iot_room_state_decoded
-- ---------------------------------------------------------------------------
ALTER TABLE public.iot_room_state_decoded
  ADD COLUMN IF NOT EXISTS lsind_regist_no text;

ALTER TABLE public.iot_room_state_decoded
  ADD COLUMN IF NOT EXISTS item_code text;

UPDATE public.iot_room_state_decoded
SET
  lsind_regist_no = COALESCE(
    lsind_regist_no,
    'FARM' || LPAD(farm_uid::text, 2, '0')
  ),
  item_code = COALESCE(item_code, 'P00')
WHERE lsind_regist_no IS NULL OR item_code IS NULL;

ALTER TABLE public.iot_room_state_decoded
  ALTER COLUMN lsind_regist_no SET NOT NULL;

ALTER TABLE public.iot_room_state_decoded
  ALTER COLUMN item_code SET NOT NULL;

DROP POLICY IF EXISTS decoded_select_scoped ON public.iot_room_state_decoded;

ALTER TABLE public.iot_room_state_decoded
  DROP COLUMN IF EXISTS farm_uid;

CREATE INDEX IF NOT EXISTS idx_iot_decoded_farm_module
  ON public.iot_room_state_decoded (lsind_regist_no, item_code, module_uid, received_at DESC);

-- ---------------------------------------------------------------------------
-- 3. user_access
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS lsind_regist_no text;

ALTER TABLE public.user_access
  ADD COLUMN IF NOT EXISTS item_code text;

UPDATE public.user_access
SET
  lsind_regist_no = COALESCE(
    lsind_regist_no,
    'FARM' || LPAD(farm_uid::text, 2, '0')
  ),
  item_code = COALESCE(item_code, 'P00')
WHERE lsind_regist_no IS NULL OR item_code IS NULL;

ALTER TABLE public.user_access
  ALTER COLUMN lsind_regist_no SET NOT NULL;

ALTER TABLE public.user_access
  ALTER COLUMN item_code SET NOT NULL;

DROP INDEX IF EXISTS idx_user_access_user_farm;

CREATE INDEX IF NOT EXISTS idx_user_access_user_farm
  ON public.user_access (user_id, lsind_regist_no, item_code);

ALTER TABLE public.user_access
  DROP COLUMN IF EXISTS farm_uid;

-- ---------------------------------------------------------------------------
-- 4. ctrl_thermo_command
-- ---------------------------------------------------------------------------
ALTER TABLE public.ctrl_thermo_command
  ADD COLUMN IF NOT EXISTS lsind_regist_no text;

ALTER TABLE public.ctrl_thermo_command
  ADD COLUMN IF NOT EXISTS item_code text;

UPDATE public.ctrl_thermo_command
SET
  lsind_regist_no = COALESCE(
    lsind_regist_no,
    'FARM' || LPAD(farm_uid::text, 2, '0')
  ),
  item_code = COALESCE(item_code, 'P00')
WHERE lsind_regist_no IS NULL OR item_code IS NULL;

ALTER TABLE public.ctrl_thermo_command
  ALTER COLUMN lsind_regist_no SET NOT NULL;

ALTER TABLE public.ctrl_thermo_command
  ALTER COLUMN item_code SET NOT NULL;

DROP INDEX IF EXISTS idx_ctrl_thermo_command_target;

CREATE INDEX IF NOT EXISTS idx_ctrl_thermo_command_target
  ON public.ctrl_thermo_command (
    lsind_regist_no,
    item_code,
    module_uid,
    ctrl_idx,
    created_at DESC
  );

ALTER TABLE public.ctrl_thermo_command
  DROP COLUMN IF EXISTS farm_uid;

-- ---------------------------------------------------------------------------
-- 5. RLS helper functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_can_read_farm(
  p_user_id uuid,
  p_lsind_regist_no text,
  p_item_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(p_user_id)
  OR EXISTS (
    SELECT 1 FROM public.user_access ua
    WHERE ua.user_id = p_user_id
      AND ua.lsind_regist_no = p_lsind_regist_no
      AND ua.item_code = p_item_code
      AND ua.can_read = true
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_command_ctrl(
  p_user_id uuid,
  p_lsind_regist_no text,
  p_item_code text,
  p_module_uid smallint,
  p_ctrl_idx smallint
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(p_user_id)
  OR EXISTS (
    SELECT 1 FROM public.user_access ua
    WHERE ua.user_id = p_user_id
      AND ua.can_command = true
      AND ua.lsind_regist_no = p_lsind_regist_no
      AND ua.item_code = p_item_code
      AND (
        ua.scope_type = 'farm'
        OR (ua.scope_type = 'module' AND ua.module_uid = p_module_uid)
        OR (
          ua.scope_type = 'ctrl'
          AND ua.module_uid = p_module_uid
          AND ua.ctrl_idx = p_ctrl_idx
        )
      )
  );
$$;

DROP FUNCTION IF EXISTS public.user_can_read_farm(uuid, smallint);
DROP FUNCTION IF EXISTS public.user_can_command_ctrl(uuid, smallint, smallint, smallint);

-- ---------------------------------------------------------------------------
-- 6. RLS policies
-- ---------------------------------------------------------------------------
CREATE POLICY decoded_select_scoped ON public.iot_room_state_decoded
  FOR SELECT TO authenticated
  USING (
    public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  );

DROP POLICY IF EXISTS thermo_command_insert_scoped ON public.ctrl_thermo_command;

CREATE POLICY thermo_command_insert_scoped ON public.ctrl_thermo_command
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.user_can_command_ctrl(
      auth.uid(),
      lsind_regist_no,
      item_code,
      module_uid,
      ctrl_idx
    )
  );

-- ---------------------------------------------------------------------------
-- 7. Replay / decoded views (lsind_regist_no + item_code)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_iot_decoded_packets AS
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
  d.lsind_regist_no,
  d.item_code,
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

COMMENT ON COLUMN public.iot_room_state_decoded.lsind_regist_no IS
  'v0x07 farm identity: livestock industry registration number';
COMMENT ON COLUMN public.iot_room_state_decoded.item_code IS
  'v0x07 farm identity: product/item code (e.g. P00)';
