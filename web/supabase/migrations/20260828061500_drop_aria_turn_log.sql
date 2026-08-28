-- Voice/DELIN turn log retired with orb+TTS. Approved drop 2026-08-28.
-- No FKs. Pig-env badge (NEXT_PUBLIC_DELIN_ENABLED) is unchanged.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-aria-turn-log-daily') THEN
    PERFORM cron.unschedule(
      (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-aria-turn-log-daily' LIMIT 1)
    );
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.cleanup_aria_turn_log(integer);
DROP TABLE IF EXISTS public.aria_turn_log;
