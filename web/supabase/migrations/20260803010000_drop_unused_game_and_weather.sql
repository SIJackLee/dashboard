-- Unused leftovers:
-- 1) game_high_scores — Piggy Jump removed (/play redirects)
-- 2) weather_warn_cache — feature removed; cron/Edge may still be active

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-weather-warn-15m') THEN
    PERFORM cron.unschedule(
      (SELECT jobid FROM cron.job WHERE jobname = 'fetch-weather-warn-15m' LIMIT 1)
    );
  END IF;
END $$;

DROP POLICY IF EXISTS weather_warn_cache_select ON public.weather_warn_cache;
DROP TABLE IF EXISTS public.weather_warn_cache;

DROP TABLE IF EXISTS public.game_high_scores;
