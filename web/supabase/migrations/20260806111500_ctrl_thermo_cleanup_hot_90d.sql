-- Phase C2: HOT applied/cancelled older than retention_days → hard DELETE (P1 = 90d)
-- Does not touch pending/sent/failed.

CREATE OR REPLACE FUNCTION public.cleanup_ctrl_thermo_hot(
  retention_days integer DEFAULT 90,
  batch_limit integer DEFAULT 5000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  days integer := GREATEST(COALESCE(retention_days, 90), 1);
  batch integer := GREATEST(COALESCE(batch_limit, 5000), 1);
  cutoff timestamptz := now() - make_interval(days => days);
  deleted integer := 0;
BEGIN
  WITH doomed AS (
    SELECT c.id
    FROM public.ctrl_thermo_command c
    WHERE c.status IN ('applied', 'cancelled')
      AND c.created_at < cutoff
    ORDER BY c.created_at
    LIMIT batch
  ),
  d AS (
    DELETE FROM public.ctrl_thermo_command c
    USING doomed
    WHERE c.id = doomed.id
    RETURNING c.id
  )
  SELECT count(*)::integer INTO deleted FROM d;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted', deleted,
    'retention_days', days,
    'batch_limit', batch,
    'cutoff', cutoff,
    'ran_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_ctrl_thermo_hot(integer, integer) IS
  'P1 HOT retention: DELETE applied/cancelled older than retention_days (default 90). Phase C2.';

REVOKE ALL ON FUNCTION public.cleanup_ctrl_thermo_hot(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_ctrl_thermo_hot(integer, integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_ctrl_thermo_hot(integer, integer) TO service_role;

-- Daily cron 19:15 UTC ≈ 04:15 KST (after stale-sent cancel at :00)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup-ctrl-thermo-hot-90d-daily'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-ctrl-thermo-hot-90d-daily',
      '15 19 * * *',
      $cmd$SELECT public.cleanup_ctrl_thermo_hot(90, 5000)$cmd$
    );
  END IF;
END;
$$;
