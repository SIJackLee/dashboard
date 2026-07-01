-- KMA 기상특보 캐시 — Edge fetch-weather-warn (getPwnStatus) → dashboard read

CREATE TABLE IF NOT EXISTS public.weather_warn_cache (
  id           int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  fetched_at   timestamptz NOT NULL DEFAULT now(),
  tm_fc        bigint,
  raw_items    jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetch_ok     boolean NOT NULL DEFAULT false,
  result_code  text,
  result_msg   text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.weather_warn_cache IS
  '기상청 getPwnStatus 최신 스냅샷 — Edge fetch-weather-warn 갱신';

INSERT INTO public.weather_warn_cache (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.weather_warn_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY weather_warn_cache_select ON public.weather_warn_cache
  FOR SELECT TO authenticated
  USING (true);

GRANT SELECT ON public.weather_warn_cache TO authenticated;

-- ---------------------------------------------------------------------------
-- pg_cron → fetch-weather-warn Edge (15분)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'fetch-weather-warn-15m';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'fetch-weather-warn-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ompufmezugftzoergdbn.supabase.co/functions/v1/fetch-weather-warn',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT cron_secret FROM public.iot_decode_config WHERE id = 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
