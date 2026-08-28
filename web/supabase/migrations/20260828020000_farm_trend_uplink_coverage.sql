-- Chart coverage: valid live uplink vs no raw vs discarded packets.
-- SECURITY DEFINER — iot_room_state_raw is not farm-user RLS; gated by user_can_read_farm.
-- 83-byte v0x0C decode went live 2026-08-24; earlier 83-byte rows are 없음 (not 희소).

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
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT public.user_can_read_farm(auth.uid(), p_lsind, p_item) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(s) ORDER BY s.bucket_at, s.controller_key), '[]'::jsonb)
  INTO v_out
  FROM (
    SELECT
      date_bin(p_bucket, r.received_at, p_from) AS bucket_at,
      format(
        'SP%s:%s:%s',
        lpad(get_byte(r.payload_bytea, 6)::text, 2, '0'),
        lpad(get_byte(r.payload_bytea, 7)::text, 2, '0'),
        lpad(get_byte(r.payload_bytea, 8)::text, 2, '0')
      ) AS controller_key,
      bool_or(
        octet_length(r.payload_bytea) IN (79, 83)
        AND get_byte(r.payload_bytea, 0) = 12
        AND get_byte(r.payload_bytea, 6) BETWEEN 1 AND 10
        AND (
          octet_length(r.payload_bytea) <> 83
          OR r.received_at >= v_first_83
        )
        AND abs(
          (
            CASE
              WHEN (
                (
                  get_byte(r.payload_bytea, 2)::bigint
                  + get_byte(r.payload_bytea, 3)::bigint * 256
                  + get_byte(r.payload_bytea, 4)::bigint * 65536
                  + get_byte(r.payload_bytea, 5)::bigint * 16777216
                ) > extract(epoch FROM r.received_at)::bigint + 120
                AND (
                  get_byte(r.payload_bytea, 2)::bigint
                  + get_byte(r.payload_bytea, 3)::bigint * 256
                  + get_byte(r.payload_bytea, 4)::bigint * 65536
                  + get_byte(r.payload_bytea, 5)::bigint * 16777216
                  - 32400
                ) <= extract(epoch FROM r.received_at)::bigint + 120
                AND (
                  get_byte(r.payload_bytea, 2)::bigint
                  + get_byte(r.payload_bytea, 3)::bigint * 256
                  + get_byte(r.payload_bytea, 4)::bigint * 65536
                  + get_byte(r.payload_bytea, 5)::bigint * 16777216
                  - 32400
                ) >= extract(epoch FROM r.received_at)::bigint - 2592000
              )
              THEN
                get_byte(r.payload_bytea, 2)::bigint
                + get_byte(r.payload_bytea, 3)::bigint * 256
                + get_byte(r.payload_bytea, 4)::bigint * 65536
                + get_byte(r.payload_bytea, 5)::bigint * 16777216
                - 32400
              ELSE
                get_byte(r.payload_bytea, 2)::bigint
                + get_byte(r.payload_bytea, 3)::bigint * 256
                + get_byte(r.payload_bytea, 4)::bigint * 65536
                + get_byte(r.payload_bytea, 5)::bigint * 16777216
            END
          ) - extract(epoch FROM r.received_at)::bigint
        ) < 7200
      ) AS valid_live,
      true AS any_raw
    FROM public.iot_room_state_raw r
    WHERE r.lsind_regist_no = p_lsind
      AND r.item_code = p_item
      AND r.received_at >= p_from
      AND r.received_at < p_to
      AND r.payload_bytea IS NOT NULL
      AND octet_length(r.payload_bytea) >= 9
      AND get_byte(r.payload_bytea, 0) = 12
      AND get_byte(r.payload_bytea, 6) BETWEEN 1 AND 10
    GROUP BY 1, 2
  ) s;

  RETURN coalesce(v_out, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.farm_trend_uplink_coverage_json(text, text, timestamptz, timestamptz, interval) IS
  'Chart uplink coverage by received_at. valid_live=decodable live clock; any_raw=uplink in bucket. SECURITY DEFINER + user_can_read_farm.';

REVOKE ALL ON FUNCTION public.farm_trend_uplink_coverage_json(text, text, timestamptz, timestamptz, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.farm_trend_uplink_coverage_json(text, text, timestamptz, timestamptz, interval) FROM anon;
GRANT EXECUTE ON FUNCTION public.farm_trend_uplink_coverage_json(text, text, timestamptz, timestamptz, interval) TO authenticated;
