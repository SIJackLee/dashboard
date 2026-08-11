-- Phase A — KMA farm weather snapshot + fetch config + pg_cron (enabled=false 초기)

CREATE TABLE IF NOT EXISTS public.farm_weather_snapshot (
  lsind_regist_no text NOT NULL,
  item_code text NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now(),
  grid_nx integer NOT NULL,
  grid_ny integer NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  kma_ncst_base_date text NOT NULL,
  kma_ncst_base_time text NOT NULL,
  kma_fcst_base_date text NOT NULL,
  kma_fcst_base_time text NOT NULL,
  temp_c numeric(4, 1),
  humidity_pct numeric(4, 1),
  wind_ms numeric(4, 1),
  precip_mm numeric(6, 2),
  forecast_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetch_ok boolean NOT NULL DEFAULT false,
  result_code text,
  result_msg text,
  raw_ncst jsonb,
  raw_fcst jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lsind_regist_no, item_code),
  CONSTRAINT farm_weather_snapshot_farm_location_fkey
    FOREIGN KEY (lsind_regist_no, item_code)
    REFERENCES public.farm_location (lsind_regist_no, item_code)
    ON DELETE CASCADE,
  CONSTRAINT farm_weather_snapshot_lat_chk CHECK (lat BETWEEN 33 AND 39),
  CONSTRAINT farm_weather_snapshot_lng_chk CHECK (lng BETWEEN 124 AND 132)
);

COMMENT ON TABLE public.farm_weather_snapshot IS
  '농장별 KMA 외기 최신 스냅샷 — Edge fetch-farm-weather 15m upsert';

CREATE TABLE IF NOT EXISTS public.weather_fetch_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  farm_keys text[] NOT NULL DEFAULT ARRAY['FARM01/P00']::text[],
  interval_minutes integer NOT NULL DEFAULT 15 CHECK (interval_minutes BETWEEN 5 AND 60),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.weather_fetch_config IS
  'KMA fetch allowlist — enabled=false until ops approval';

INSERT INTO public.weather_fetch_config (id, enabled, farm_keys)
VALUES (1, false, ARRAY['FARM01/P00']::text[])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.farm_weather_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_fetch_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY farm_weather_snapshot_select ON public.farm_weather_snapshot
  FOR SELECT TO authenticated
  USING (
    public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  );

CREATE POLICY weather_fetch_config_admin_select ON public.weather_fetch_config
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.farm_weather_snapshot TO authenticated;

-- ---------------------------------------------------------------------------
-- pg_cron → fetch-farm-weather Edge (15분). Edge는 config.enabled=false면 no-op.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'fetch-farm-weather-15m';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'fetch-farm-weather-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ompufmezugftzoergdbn.supabase.co/functions/v1/fetch-farm-weather',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT cron_secret FROM public.iot_decode_config WHERE id = 1)
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
