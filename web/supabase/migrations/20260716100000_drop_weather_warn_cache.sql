-- 기상특보 기능 제거 — weather_warn_cache 및 pg_cron 정리
-- 운영 적용 전: Edge fetch-weather-warn 배포 해제 권장

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
