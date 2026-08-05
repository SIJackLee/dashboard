-- IoT 30-day retention: decoded month detach→archive, raw DELETE (batched).
-- Schedule: daily 03:30 KST (UTC 18:30). Approved schedule on 2026-08-05.

CREATE SCHEMA IF NOT EXISTS archive;

CREATE OR REPLACE FUNCTION public.cleanup_iot_retention_30d(
  retention_days integer DEFAULT 30,
  raw_batch_limit integer DEFAULT 10000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, archive, pg_catalog
AS $$
DECLARE
  days integer := COALESCE(NULLIF(retention_days, 0), 30);
  batch integer := GREATEST(COALESCE(raw_batch_limit, 10000), 1);
  cutoff timestamptz := now() - make_interval(days => days);
  part record;
  detached text[] := ARRAY[]::text[];
  raw_deleted integer := 0;
  archive_name text;
  fkey_name text;
BEGIN
  IF days < 1 THEN
    days := 30;
    cutoff := now() - make_interval(days => days);
  END IF;

  FOR part IN
    SELECT
      child.oid AS child_oid,
      child.relname AS child_name,
      (regexp_match(
        pg_get_expr(child.relpartbound, child.oid),
        E'TO \\(''([^'']+)''\\)'
      ))[1]::timestamptz AS range_to
    FROM pg_inherits inh
    JOIN pg_class child ON child.oid = inh.inhrelid
    WHERE inh.inhparent = 'public.iot_room_state_decoded'::regclass
      AND child.relkind IN ('r', 'p')
      AND child.relname <> 'iot_room_state_decoded_p_default'
  LOOP
    IF part.range_to IS NULL OR part.range_to > cutoff THEN
      CONTINUE;
    END IF;

    archive_name := part.child_name || '_archived';

    EXECUTE format(
      'ALTER TABLE public.iot_room_state_decoded DETACH PARTITION public.%I',
      part.child_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I SET SCHEMA archive',
      part.child_name
    );

    -- Prevent raw DELETE CASCADE from wiping archived decoded rows
    FOR fkey_name IN
      SELECT con.conname
      FROM pg_constraint con
      WHERE con.conrelid = format('archive.%I', part.child_name)::regclass
        AND con.contype = 'f'
        AND pg_get_constraintdef(con.oid) ILIKE '%iot_room_state_raw%'
    LOOP
      EXECUTE format(
        'ALTER TABLE archive.%I DROP CONSTRAINT %I',
        part.child_name,
        fkey_name
      );
    END LOOP;

    IF to_regclass(format('archive.%I', archive_name)) IS NULL THEN
      EXECUTE format(
        'ALTER TABLE archive.%I RENAME TO %I',
        part.child_name,
        archive_name
      );
    END IF;

    detached := array_append(detached, archive_name);
  END LOOP;

  WITH doomed AS (
    SELECT id
    FROM public.iot_room_state_raw
    WHERE received_at < cutoff
    ORDER BY id
    LIMIT batch
  ),
  deleted AS (
    DELETE FROM public.iot_room_state_raw r
    USING doomed d
    WHERE r.id = d.id
    RETURNING r.id
  )
  SELECT count(*)::integer INTO raw_deleted FROM deleted;

  RETURN jsonb_build_object(
    'ok', true,
    'retention_days', days,
    'cutoff', cutoff,
    'detached_partitions', detached,
    'raw_deleted', raw_deleted,
    'ran_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_iot_retention_30d(integer, integer) IS
  'Detach decoded month partitions fully older than N days into archive schema; batch-delete old raw. SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.cleanup_iot_retention_30d(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_iot_retention_30d(integer, integer) TO service_role;

-- Daily 03:30 KST = 18:30 UTC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-iot-retention-30d-daily') THEN
    PERFORM cron.unschedule(
      (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-iot-retention-30d-daily' LIMIT 1)
    );
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-iot-retention-30d-daily',
  '30 18 * * *',
  $$SELECT public.cleanup_iot_retention_30d(30, 10000);$$
);
