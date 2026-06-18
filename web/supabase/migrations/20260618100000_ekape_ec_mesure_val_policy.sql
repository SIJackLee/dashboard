-- Ekape export policy: EC01~03 — mesureVal01(동작출력 %)만 전송
-- thermo(설정온도·편차·최저/최고환기), RPM·동작상태·측정주기·일괄제어 미전송

DELETE FROM public.ekape_mesure_val_lut
WHERE eqpmn_code IN ('EC01', 'EC02', 'EC03')
  AND slot <> 1;

UPDATE public.ekape_mesure_val_lut
SET notes = '동작출력 % — EC01~03 유일 전송 필드; thermo·RPM·동작상태 미전송'
WHERE eqpmn_code IN ('EC01', 'EC02', 'EC03')
  AND slot = 1;

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
  '축평원 v4.0 export — EC01~03은 mesureVal01(출력%)만; thermo·RPM 등 미전송';
