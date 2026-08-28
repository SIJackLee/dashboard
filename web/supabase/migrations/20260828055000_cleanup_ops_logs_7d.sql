-- Ops logs (pg_net HTTP responses + pg_cron run details) keep 7 days.
-- Daily 03:50 KST (UTC 18:50). VACUUM FULL is one-shot, not in this job.

CREATE OR REPLACE FUNCTION public.cleanup_ops_logs_7d(
  retention_days integer DEFAULT 7,
  batch_limit integer DEFAULT 10000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = net, cron, public, pg_catalog
AS $$
DECLARE
  days integer := COALESCE(retention_days, 7);
  batch integer := GREATEST(COALESCE(batch_limit, 10000), 1);
  cutoff timestamptz;
  http_deleted integer := 0;
  cron_deleted integer := 0;
  n integer;
  loops integer := 0;
  max_loops integer := 200;
BEGIN
  IF days < 1 THEN
    days := 7;
  END IF;
  cutoff := now() - make_interval(days => days);

  LOOP
    loops := loops + 1;
    EXIT WHEN loops > max_loops;

    WITH doomed AS (
      SELECT id
      FROM net._http_response
      WHERE created < cutoff
      ORDER BY id
      LIMIT batch
    ),
    deleted AS (
      DELETE FROM net._http_response r
      USING doomed d
      WHERE r.id = d.id
      RETURNING r.id
    )
    SELECT count(*)::integer INTO n FROM deleted;

    http_deleted := http_deleted + n;
    EXIT WHEN n = 0;
  END LOOP;

  loops := 0;
  LOOP
    loops := loops + 1;
    EXIT WHEN loops > max_loops;

    WITH doomed AS (
      SELECT runid
      FROM cron.job_run_details
      WHERE end_time IS NOT NULL
        AND end_time < cutoff
      ORDER BY runid
      LIMIT batch
    ),
    deleted AS (
      DELETE FROM cron.job_run_details r
      USING doomed d
      WHERE r.runid = d.runid
      RETURNING r.runid
    )
    SELECT count(*)::integer INTO n FROM deleted;

    cron_deleted := cron_deleted + n;
    EXIT WHEN n = 0;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'retention_days', days,
    'cutoff', cutoff,
    'http_deleted', http_deleted,
    'cron_deleted', cron_deleted,
    'ran_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_ops_logs_7d(integer, integer) IS
  'Batch-delete net._http_response and finished cron.job_run_details older than N days (default 7). SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.cleanup_ops_logs_7d(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_ops_logs_7d(integer, integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_ops_logs_7d(integer, integer) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-ops-logs-7d-daily') THEN
    PERFORM cron.unschedule(
      (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-ops-logs-7d-daily' LIMIT 1)
    );
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-ops-logs-7d-daily',
  '50 18 * * *',
  $$SELECT public.cleanup_ops_logs_7d(7, 10000);$$
);
