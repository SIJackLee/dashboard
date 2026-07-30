-- ARIA 턴 로그 보관 7일 — 매일 정리
CREATE OR REPLACE FUNCTION public.cleanup_aria_turn_log(retention_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  IF retention_days IS NULL OR retention_days < 1 THEN
    retention_days := 7;
  END IF;

  DELETE FROM public.aria_turn_log
  WHERE created_at < (now() - make_interval(days => retention_days));

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_aria_turn_log(integer) IS
  'aria_turn_log 보관기간(기본 7일) 초과 행 삭제. SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.cleanup_aria_turn_log(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_aria_turn_log(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_aria_turn_log(integer) TO service_role;

-- 매일 03:15 KST (UTC 18:15)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-aria-turn-log-daily') THEN
    PERFORM cron.unschedule(
      (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-aria-turn-log-daily' LIMIT 1)
    );
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-aria-turn-log-daily',
  '15 18 * * *',
  $$SELECT public.cleanup_aria_turn_log(7);$$
);
