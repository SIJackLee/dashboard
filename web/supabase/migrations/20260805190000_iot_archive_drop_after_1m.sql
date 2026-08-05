-- Archive soak: DROP detached decoded month tables 1 month after detach eligibility.
-- Detach when range_to <= now()-30d; DROP when month_end <= now()-60d
-- (30d HOT + 30d archive). Job daily after retention.

CREATE OR REPLACE FUNCTION public.cleanup_iot_archive_drop(
  archive_soak_days integer DEFAULT 30,
  retention_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, archive, pg_catalog
AS $$
DECLARE
  soak integer := GREATEST(COALESCE(archive_soak_days, 30), 1);
  ret integer := GREATEST(COALESCE(retention_days, 30), 1);
  cutoff timestamptz := now() - make_interval(days => ret + soak);
  r record;
  dropped text[] := ARRAY[]::text[];
  yyyymm text;
  month_start date;
  month_end date;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'archive'
      AND c.relkind = 'r'
      AND c.relname ~ '^iot_room_state_decoded_p_[0-9]{4}_[0-9]{2}_archived$'
  LOOP
    yyyymm := substring(r.relname from 'p_([0-9]{4}_[0-9]{2})_archived');
    IF yyyymm IS NULL THEN
      CONTINUE;
    END IF;
    month_start := to_date(replace(yyyymm, '_', '-') || '-01', 'YYYY-MM-DD');
    month_end := (month_start + interval '1 month')::date;
    IF month_end::timestamptz > cutoff THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP TABLE IF EXISTS archive.%I', r.relname);
    dropped := array_append(dropped, r.relname);
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'retention_days', ret,
    'archive_soak_days', soak,
    'cutoff', cutoff,
    'dropped', dropped,
    'ran_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_iot_archive_drop(integer, integer) IS
  'DROP archive.iot_room_state_decoded_p_YYYY_MM_archived when month end older than retention+soak (default 30+30).';

REVOKE ALL ON FUNCTION public.cleanup_iot_archive_drop(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_iot_archive_drop(integer, integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-iot-archive-drop-daily') THEN
    PERFORM cron.unschedule(
      (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-iot-archive-drop-daily' LIMIT 1)
    );
  END IF;
END $$;

-- Daily 03:45 KST = 18:45 UTC (after retention 18:30)
SELECT cron.schedule(
  'cleanup-iot-archive-drop-daily',
  '45 18 * * *',
  $cron$SELECT public.cleanup_iot_archive_drop(30, 30);$cron$
);
