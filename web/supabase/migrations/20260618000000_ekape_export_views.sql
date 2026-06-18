-- Ekape v4.0 export presentation layer (RS-DB-C)
-- Flow: iot_room_state_raw → ekape_snapshot.py → iot_ctrl_decoded_snapshot
--       → v_ekape_export_row (26 cols, 1 row = 1 NDJSON line) → future FTP Worker

-- ---------------------------------------------------------------------------
-- 1. Export config (per farm)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ekape_export_config (
  lsind_regist_no text NOT NULL,
  item_code text NOT NULL,
  makr_id text NOT NULL DEFAULT 'SUNGIL',
  measure_interval_min smallint NOT NULL DEFAULT 10,
  external_stall_no text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lsind_regist_no, item_code)
);

COMMENT ON TABLE public.ekape_export_config IS
  '축평원 연계 export 설정 — makrId, 측정주기(분), 외부설치 stallNo 등';

-- ---------------------------------------------------------------------------
-- 2. mesureVal LUT (PDF §4.1 ES01/02, §4.2 EC01~03 — reference / audit)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ekape_mesure_val_lut (
  eqpmn_code text NOT NULL,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 15),
  field_name text NOT NULL,
  source_kind text NOT NULL CHECK (
    source_kind IN ('measure', 'config', 'const', 'derive_on', 'derive_individual')
  ),
  source_key text,
  notes text,
  PRIMARY KEY (eqpmn_code, slot)
);

COMMENT ON TABLE public.ekape_mesure_val_lut IS
  '축평원 mesureVal01~15 의미 — v_ekape_export_row CASE와 동기화';

INSERT INTO public.ekape_mesure_val_lut (
  eqpmn_code, slot, field_name, source_kind, source_key, notes
) VALUES
  ('ES01', 1, 'mesureVal01', 'measure', 'tempsC[sn-1]', '온도(℃)'),
  ('ES01', 2, 'mesureVal02', 'config', 'measure_interval_min', '측정주기(분)'),
  ('ES01', 3, 'mesureVal03', 'derive_on', 'tempsC', '장비동작 on/off'),
  ('ES02', 1, 'mesureVal01', 'measure', 'humidityPct|tempsC[2]', '습도(%) — sn1=humidity, sn2=tempsC[2]'),
  ('ES02', 2, 'mesureVal02', 'config', 'measure_interval_min', '측정주기(분)'),
  ('ES02', 3, 'mesureVal03', 'derive_on', 'humidityPct', '장비동작 on/off'),
  ('EC01', 1, 'mesureVal01', 'measure', 'outputs[sn]', '동작출력 % — 유일 전송 필드'),
  ('EC02', 1, 'mesureVal01', 'measure', 'outputs[sn]', '동작출력(개폐율) % — 유일 전송 필드'),
  ('EC03', 1, 'mesureVal01', 'measure', 'outputs[sn]', '동작출력 % — 유일 전송 필드')
ON CONFLICT (eqpmn_code, slot) DO UPDATE SET
  field_name = EXCLUDED.field_name,
  source_kind = EXCLUDED.source_kind,
  source_key = EXCLUDED.source_key,
  notes = EXCLUDED.notes;

-- ---------------------------------------------------------------------------
-- 3. Decoded controller snapshot (filled by RSD/ekape_snapshot.py)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.iot_ctrl_decoded_snapshot (
  lsind_regist_no text NOT NULL,
  item_code text NOT NULL,
  module_uid smallint NOT NULL,
  controller_key text NOT NULL,
  raw_id bigint NOT NULL REFERENCES public.iot_room_state_raw (id) ON DELETE CASCADE,
  wire_ver smallint NOT NULL,
  packet_mode text NOT NULL DEFAULT 'live',
  mesure_dt text NOT NULL,
  received_at timestamptz NOT NULL,
  decoded_json jsonb NOT NULL,
  decoded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lsind_regist_no, item_code, module_uid, controller_key)
);

CREATE INDEX IF NOT EXISTS idx_iot_ctrl_snapshot_farm_received
  ON public.iot_ctrl_decoded_snapshot (lsind_regist_no, item_code, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_iot_ctrl_snapshot_raw
  ON public.iot_ctrl_decoded_snapshot (raw_id);

COMMENT ON TABLE public.iot_ctrl_decoded_snapshot IS
  'LIVE controller decode snapshot — 1 row per (farm, module, controllerKey); ekape View 입력';

ALTER TABLE public.iot_ctrl_decoded_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY iot_ctrl_snapshot_select ON public.iot_ctrl_decoded_snapshot
  FOR SELECT TO authenticated
  USING (
    public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  );

-- ---------------------------------------------------------------------------
-- 4. Export cursor (future FTP Worker — 전송 완료 추적)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ekape_export_cursor (
  lsind_regist_no text NOT NULL,
  item_code text NOT NULL,
  eqpmn_code text NOT NULL,
  last_raw_id bigint,
  last_mesure_dt text,
  last_sent_at timestamptz,
  PRIMARY KEY (lsind_regist_no, item_code, eqpmn_code)
);

COMMENT ON TABLE public.ekape_export_cursor IS
  '축평원 FTP Worker 전송 커서 — eqpmnCode 단위';

-- ---------------------------------------------------------------------------
-- 5. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ekape_text_or_empty(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(NULLIF(TRIM(p_value), ''), '');
$$;

CREATE OR REPLACE FUNCTION public.ekape_json_elem_text(p_json jsonb, p_keys text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.ekape_text_or_empty(p_json #>> p_keys);
$$;

CREATE OR REPLACE FUNCTION public.ekape_device_on(p_output text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN public.ekape_text_or_empty(p_output) = '' THEN '0'
    WHEN p_output ~ '^\d+$' AND p_output::integer > 0 THEN '1'
    WHEN p_output ~ '^\d+\.\d+$' AND p_output::numeric > 0 THEN '1'
    ELSE '0'
  END;
$$;

-- ---------------------------------------------------------------------------
-- 6. v_iot_ctrl_latest — LIVE snapshot (1 row per controller)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_iot_ctrl_latest AS
SELECT
  s.lsind_regist_no,
  s.item_code,
  s.module_uid,
  s.controller_key,
  s.raw_id,
  s.wire_ver,
  s.packet_mode,
  s.mesure_dt,
  s.received_at,
  s.decoded_json,
  s.decoded_at
FROM public.iot_ctrl_decoded_snapshot s
WHERE s.packet_mode = 'live';

COMMENT ON VIEW public.v_iot_ctrl_latest IS
  'LIVE decode snapshot per controller — Dashboard pickLatestLiveControllerRows 동등';

GRANT SELECT ON public.v_iot_ctrl_latest TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. v_ekape_export_row — 축평원 26필드 flatten (1 row = 1 .log JSON line)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_ekape_export_row AS
WITH cfg AS (
  SELECT
    c.lsind_regist_no,
    c.item_code,
    c.makr_id,
    c.measure_interval_min,
    c.external_stall_no,
    c.enabled
  FROM public.ekape_export_config c
),
base AS (
  SELECT
    s.lsind_regist_no,
    s.item_code,
    s.module_uid,
    s.controller_key,
    s.raw_id,
    s.mesure_dt,
    s.received_at,
    s.decoded_json,
    COALESCE(cfg.makr_id, 'SUNGIL') AS makr_id,
    COALESCE(cfg.measure_interval_min, 10) AS measure_interval_min,
    COALESCE(cfg.external_stall_no, '') AS external_stall_no
  FROM public.iot_ctrl_decoded_snapshot s
  LEFT JOIN cfg
    ON cfg.lsind_regist_no = s.lsind_regist_no
   AND cfg.item_code = s.item_code
  WHERE s.packet_mode = 'live'
    AND COALESCE(cfg.enabled, true)
),
stall AS (
  SELECT
    b.*,
    public.ekape_json_elem_text(b.decoded_json, ARRAY['stallTyCode']) AS stall_ty_code,
    COALESCE(
      NULLIF(public.ekape_json_elem_text(b.decoded_json, ARRAY['stallNo']), ''),
      b.external_stall_no
    ) AS stall_no
  FROM base b
),
es01 AS (
  SELECT
    st.lsind_regist_no,
    st.item_code,
    st.module_uid,
    st.controller_key,
    st.raw_id,
    st.mesure_dt,
    st.received_at,
    st.makr_id,
    st.measure_interval_min,
    'ES01'::text AS eqpmn_code,
    t.sn::text AS eqpmn_sn,
    ''::text AS eqpmn_esntl_sn,
    LPAD(t.sn::text, 2, '0') AS eqpmn_no,
    st.stall_ty_code,
    st.stall_no,
    ''::text AS room_no,
    ''::text AS room_dtl_no,
    public.ekape_text_or_empty(t.temp_val) AS measure_primary
  FROM stall st
  CROSS JOIN LATERAL (
    VALUES
      (1, public.ekape_json_elem_text(st.decoded_json, ARRAY['tempsC', '0'])),
      (2, public.ekape_json_elem_text(st.decoded_json, ARRAY['tempsC', '1']))
  ) AS t(sn, temp_val)
  WHERE public.ekape_text_or_empty(t.temp_val) <> ''
),
es02 AS (
  SELECT
    st.lsind_regist_no,
    st.item_code,
    st.module_uid,
    st.controller_key,
    st.raw_id,
    st.mesure_dt,
    st.received_at,
    st.makr_id,
    st.measure_interval_min,
    'ES02'::text AS eqpmn_code,
    t.sn::text AS eqpmn_sn,
    ''::text AS eqpmn_esntl_sn,
    LPAD(t.sn::text, 2, '0') AS eqpmn_no,
    st.stall_ty_code,
    st.stall_no,
    ''::text AS room_no,
    ''::text AS room_dtl_no,
    public.ekape_text_or_empty(t.hum_val) AS measure_primary
  FROM stall st
  CROSS JOIN LATERAL (
    VALUES
      (1, public.ekape_json_elem_text(st.decoded_json, ARRAY['humidityPct'])),
      (2, public.ekape_json_elem_text(st.decoded_json, ARRAY['tempsC', '2']))
  ) AS t(sn, hum_val)
  WHERE public.ekape_text_or_empty(t.hum_val) <> ''
),
ec AS (
  SELECT
    st.lsind_regist_no,
    st.item_code,
    st.module_uid,
    st.controller_key,
    st.raw_id,
    st.mesure_dt,
    st.received_at,
    st.makr_id,
    st.measure_interval_min,
    ch.value->>'eqpmnCode' AS eqpmn_code,
    out.key AS eqpmn_sn,
    ''::text AS eqpmn_esntl_sn,
    LPAD(out.key, 2, '0') AS eqpmn_no,
    st.stall_ty_code,
    st.stall_no,
    ''::text AS room_no,
    ''::text AS room_dtl_no,
    public.ekape_text_or_empty(out.value) AS measure_primary
  FROM stall st
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(st.decoded_json->'channels', '[]'::jsonb)
  ) AS ch(value)
  CROSS JOIN LATERAL jsonb_each_text(
    COALESCE(ch.value->'outputs', '{}'::jsonb)
  ) AS out(key, value)
  WHERE ch.value->>'eqpmnCode' IN ('EC01', 'EC02', 'EC03')
    AND public.ekape_text_or_empty(out.value) <> ''
),
unioned AS (
  SELECT * FROM es01
  UNION ALL
  SELECT * FROM es02
  UNION ALL
  SELECT * FROM ec
)
SELECT
  u.lsind_regist_no,
  u.item_code,
  u.makr_id,
  u.eqpmn_code,
  u.eqpmn_esntl_sn,
  u.eqpmn_no,
  u.stall_ty_code,
  u.stall_no,
  u.room_no,
  u.room_dtl_no,
  u.mesure_dt,
  CASE
    WHEN u.eqpmn_code IN ('ES01', 'ES02', 'EC01', 'EC02', 'EC03')
      THEN u.measure_primary
    ELSE ''
  END AS mesure_val_01,
  CASE
    WHEN u.eqpmn_code IN ('ES01', 'ES02') THEN u.measure_interval_min::text
    ELSE ''
  END AS mesure_val_02,
  CASE
    WHEN u.eqpmn_code IN ('ES01', 'ES02') THEN public.ekape_device_on(u.measure_primary)
    ELSE ''
  END AS mesure_val_03,
  ''::text AS mesure_val_04,
  ''::text AS mesure_val_05,
  ''::text AS mesure_val_06,
  ''::text AS mesure_val_07,
  ''::text AS mesure_val_08,
  ''::text AS mesure_val_09,
  ''::text AS mesure_val_10,
  ''::text AS mesure_val_11,
  ''::text AS mesure_val_12,
  ''::text AS mesure_val_13,
  ''::text AS mesure_val_14,
  ''::text AS mesure_val_15,
  u.raw_id AS source_raw_id,
  u.module_uid,
  u.controller_key,
  u.eqpmn_sn,
  u.received_at
FROM unioned u;

COMMENT ON VIEW public.v_ekape_export_row IS
  '축평원 v4.0 export 26컬럼 — 1행=NDJSON 1줄; Worker는 SELECT 후 camelCase 직렬화';

GRANT SELECT ON public.v_ekape_export_row TO authenticated;
GRANT SELECT ON public.ekape_export_config TO authenticated;
GRANT SELECT ON public.ekape_mesure_val_lut TO authenticated;
