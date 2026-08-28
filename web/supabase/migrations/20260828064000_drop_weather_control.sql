-- Weather CTRL retired 2026-08-28. Hub UI already unmounted.
-- Does not touch ctrl_thermo_command or farm_location.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fetch-farm-weather-15m') THEN
    PERFORM cron.unschedule(
      (SELECT jobid FROM cron.job WHERE jobname = 'fetch-farm-weather-15m' LIMIT 1)
    );
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-weather-rec-5m') THEN
    PERFORM cron.unschedule(
      (SELECT jobid FROM cron.job WHERE jobname = 'expire-weather-rec-5m' LIMIT 1)
    );
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.approve_weather_control_recommendation(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.dismiss_weather_control_recommendation(uuid);
DROP FUNCTION IF EXISTS public.expire_weather_control_recommendations();

DROP TABLE IF EXISTS public.weather_control_recommendation;
DROP TABLE IF EXISTS public.weather_control_config;
DROP TABLE IF EXISTS public.farm_weather_snapshot;
DROP TABLE IF EXISTS public.weather_fetch_config;
