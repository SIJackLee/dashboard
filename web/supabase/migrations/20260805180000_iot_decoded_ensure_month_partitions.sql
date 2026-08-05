-- Ensure monthly partitions for iot_room_state_decoded (current + N ahead).
-- Avoid DEFAULT catching live traffic. Daily cron 03:00 KST (UTC 18:00).

CREATE OR REPLACE FUNCTION public.ensure_iot_decoded_month_partitions(
  months_ahead integer DEFAULT 2
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  ahead integer := GREATEST(COALESCE(months_ahead, 2), 0);
  i integer;
  month_start date;
  month_end date;
  part_name text;
  created text[] := ARRAY[]::text[];
  skipped text[] := ARRAY[]::text[];
BEGIN
  IF ahead > 24 THEN
    ahead := 24;
  END IF;

  FOR i IN 0..ahead LOOP
    month_start := (
      date_trunc('month', timezone('UTC', now())) + (i || ' months')::interval
    )::date;
    month_end := (month_start + interval '1 month')::date;
    part_name := format(
      'iot_room_state_decoded_p_%s',
      to_char(month_start, 'YYYY_MM')
    );

    IF to_regclass(format('public.%I', part_name)) IS NOT NULL THEN
      skipped := array_append(skipped, part_name);
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE TABLE public.%I PARTITION OF public.iot_room_state_decoded
         FOR VALUES FROM (%L) TO (%L)',
      part_name,
      month_start,
      month_end
    );
    created := array_append(created, part_name);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'months_ahead', ahead,
    'created', created,
    'already_present', skipped,
    'ran_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.ensure_iot_decoded_month_partitions(integer) IS
  'Create missing monthly partitions for iot_room_state_decoded (UTC month bounds). SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.ensure_iot_decoded_month_partitions(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_iot_decoded_month_partitions(integer) TO service_role;

-- Seed once: current + 2 months
SELECT public.ensure_iot_decoded_month_partitions(2);

-- Daily 03:00 KST = 18:00 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ensure-iot-decoded-partitions-daily') THEN
    PERFORM cron.unschedule(
      (SELECT jobid FROM cron.job WHERE jobname = 'ensure-iot-decoded-partitions-daily' LIMIT 1)
    );
  END IF;
END $$;

SELECT cron.schedule(
  'ensure-iot-decoded-partitions-daily',
  '0 18 * * *',
  $cron$SELECT public.ensure_iot_decoded_month_partitions(2);$cron$
);
