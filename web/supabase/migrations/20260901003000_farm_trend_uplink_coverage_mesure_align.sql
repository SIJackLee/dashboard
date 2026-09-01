-- Chart uplink coverage: 측정시각(mesure) 정렬 재작성.
--
-- 배경: 기존 함수는 raw를 received_at 기준으로 버킷팅하고 valid_live를 수신±2h
-- 신선도로 판정했다. 그런데 추이 차트 온도선은 mesure_at(측정시각) 축이다. FARM02
-- 처럼 버퍼 지연/재전송으로 수신이 측정보다 ~24h 늦은 소스는 축이 어긋나
-- sparse가 아니라 void/offline로 분류되어, raw가 있는데도 hold가 걸리지 않고
-- 차트에 공백이 남았다.
--
-- 수정: (1) 버킷을 보정 측정 epoch(to_timestamp)로 배치, (2) 창 필터를 측정시각
-- 기준으로, (3) valid_live를 "디코딩 가능 포맷"으로 완화(신선도 조건 제거),
-- (4) clock 모드를 iot_decode_config.clock_kst_farm_keys로 판정(KST 소스는 항상
-- -9h, 그 외는 기존 auto future-only 휴리스틱 — decode-batch와 동일 계약).
--
-- 반환 컬럼(bucket_at/controller_key/valid_live/any_raw)은 불변 → 프런트 계약 유지.
-- received_at 인덱스 유지를 위해 스캔 한정용 pre-filter(-2일/+3일)를 둔다.
-- 롤백: 20260828020000_farm_trend_uplink_coverage.sql 정의를 재적용.

CREATE INDEX IF NOT EXISTS idx_iot_raw_farm_received
  ON public.iot_room_state_raw (lsind_regist_no, item_code, received_at);

CREATE OR REPLACE FUNCTION public.farm_trend_uplink_coverage_json(
  p_lsind text,
  p_item text,
  p_from timestamptz,
  p_to timestamptz,
  p_bucket interval
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_first_83 timestamptz := TIMESTAMPTZ '2026-08-24 00:00:00+00';
  v_kst boolean;
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT public.user_can_read_farm(auth.uid(), p_lsind, p_item) THEN
    RETURN '[]'::jsonb;
  END IF;

  -- KST-stuffed 펌웨어 허용목록이면 항상 -9h (decode-batch clockModeForFarm과 동일).
  SELECT COALESCE(
           p_lsind = ANY(c.clock_kst_farm_keys)
           OR (p_lsind || '/' || p_item) = ANY(c.clock_kst_farm_keys),
           false)
    INTO v_kst
    FROM public.iot_decode_config c
    WHERE c.id = 1;
  v_kst := COALESCE(v_kst, false);

  SELECT coalesce(
           jsonb_agg(row_to_json(s) ORDER BY s.bucket_at, s.controller_key),
           '[]'::jsonb)
  INTO v_out
  FROM (
    SELECT
      date_bin(p_bucket, to_timestamp(c.mesure_epoch), p_from) AS bucket_at,
      format(
        'SP%s:%s:%s',
        lpad(get_byte(c.pb, 6)::text, 2, '0'),
        lpad(get_byte(c.pb, 7)::text, 2, '0'),
        lpad(get_byte(c.pb, 8)::text, 2, '0')
      ) AS controller_key,
      bool_or(
        octet_length(c.pb) IN (79, 83)
        AND get_byte(c.pb, 0) = 12
        AND get_byte(c.pb, 6) BETWEEN 1 AND 10
        AND (octet_length(c.pb) <> 83 OR c.received_at >= v_first_83)
      ) AS valid_live,
      true AS any_raw
    FROM (
      SELECT
        r.received_at,
        r.payload_bytea AS pb,
        CASE
          WHEN v_kst THEN raw.raw_epoch - 32400
          WHEN raw.raw_epoch > extract(epoch FROM r.received_at)::bigint + 120
               AND raw.raw_epoch - 32400 <= extract(epoch FROM r.received_at)::bigint + 120
               AND raw.raw_epoch - 32400 >= extract(epoch FROM r.received_at)::bigint - 2592000
            THEN raw.raw_epoch - 32400
          ELSE raw.raw_epoch
        END AS mesure_epoch
      FROM public.iot_room_state_raw r
      CROSS JOIN LATERAL (
        SELECT (
          get_byte(r.payload_bytea, 2)::bigint
          + get_byte(r.payload_bytea, 3)::bigint * 256
          + get_byte(r.payload_bytea, 4)::bigint * 65536
          + get_byte(r.payload_bytea, 5)::bigint * 16777216
        ) AS raw_epoch
      ) raw
      WHERE r.lsind_regist_no = p_lsind
        AND r.item_code = p_item
        -- 스캔 한정(인덱스 유지). 측정↔수신 지연(FARM02 ~24-33h)을 덮는 여유.
        AND r.received_at >= p_from - interval '2 days'
        AND r.received_at <  p_to   + interval '3 days'
        AND r.payload_bytea IS NOT NULL
        AND octet_length(r.payload_bytea) >= 9
        AND get_byte(r.payload_bytea, 0) = 12
        AND get_byte(r.payload_bytea, 6) BETWEEN 1 AND 10
    ) c
    -- 정확도: 측정시각이 창에 드는 raw만.
    WHERE to_timestamp(c.mesure_epoch) >= p_from
      AND to_timestamp(c.mesure_epoch) <  p_to
    GROUP BY 1, 2
  ) s;

  RETURN coalesce(v_out, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.farm_trend_uplink_coverage_json(text, text, timestamptz, timestamptz, interval) IS
  'Chart uplink coverage by mesure time (clock-corrected). valid_live=decodable packet; any_raw=uplink whose measurement falls in bucket. KST-stuffed sources (iot_decode_config.clock_kst_farm_keys) always -9h. SECURITY DEFINER + user_can_read_farm.';

REVOKE ALL ON FUNCTION public.farm_trend_uplink_coverage_json(text, text, timestamptz, timestamptz, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.farm_trend_uplink_coverage_json(text, text, timestamptz, timestamptz, interval) FROM anon;
GRANT EXECUTE ON FUNCTION public.farm_trend_uplink_coverage_json(text, text, timestamptz, timestamptz, interval) TO authenticated;
