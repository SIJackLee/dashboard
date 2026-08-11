-- Phase B — weather control recommendation + config + expire cron

CREATE TABLE IF NOT EXISTS public.weather_control_recommendation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lsind_regist_no text NOT NULL,
  item_code text NOT NULL,
  module_uid integer NOT NULL,
  controller_key text NOT NULL,
  stall_ty_code text NOT NULL,
  stall_no text NOT NULL,
  eqpmn_no text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'dismissed', 'expired')),
  rule_id text NOT NULL,
  current_setpoint_temp numeric(4, 1) NOT NULL,
  current_temp_deviation numeric(4, 1) NOT NULL,
  current_min_vent_pct integer NOT NULL,
  current_max_vent_pct integer NOT NULL,
  proposed_setpoint_temp numeric(4, 1) NOT NULL,
  proposed_temp_deviation numeric(4, 1) NOT NULL,
  proposed_min_vent_pct integer NOT NULL,
  proposed_max_vent_pct integer NOT NULL,
  internal_temp_c numeric(4, 1),
  internal_humidity_pct numeric(4, 1),
  external_temp_c numeric(4, 1),
  external_humidity_pct numeric(4, 1),
  reason_ko text NOT NULL,
  reason_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  weather_observed_at timestamptz NOT NULL,
  live_received_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  command_id uuid REFERENCES public.ctrl_thermo_command(id)
);

COMMENT ON TABLE public.weather_control_recommendation IS
  '기상·LIVE 기반 CTRL 권장 draft — Phase B pending 30m';

CREATE UNIQUE INDEX IF NOT EXISTS uq_weather_rec_pending_controller
  ON public.weather_control_recommendation (lsind_regist_no, item_code, controller_key)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_weather_rec_farm_status_expires
  ON public.weather_control_recommendation (
    lsind_regist_no,
    item_code,
    status,
    expires_at DESC
  );

CREATE TABLE IF NOT EXISTS public.weather_control_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  farm_keys text[] NOT NULL DEFAULT ARRAY['FARM01/P00']::text[],
  target_controller_key text,
  pending_ttl_minutes integer NOT NULL DEFAULT 30 CHECK (pending_ttl_minutes BETWEEN 5 AND 120),
  eval_after_weather_fetch boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.weather_control_config IS
  '기상 CTRL 규칙 evaluate allowlist — enabled=false until ops approval';

INSERT INTO public.weather_control_config (id, enabled, farm_keys)
VALUES (1, false, ARRAY['FARM01/P00']::text[])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.weather_control_recommendation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_control_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY weather_control_recommendation_select
  ON public.weather_control_recommendation
  FOR SELECT TO authenticated
  USING (
    public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  );

CREATE POLICY weather_control_config_admin_select
  ON public.weather_control_config
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.weather_control_recommendation TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_weather_control_recommendations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.weather_control_recommendation
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending' AND expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.expire_weather_control_recommendations IS
  'pending weather_control_recommendation TTL expire';

REVOKE ALL ON FUNCTION public.expire_weather_control_recommendations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_weather_control_recommendations() TO postgres, service_role;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'expire-weather-rec-5m';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'expire-weather-rec-5m',
  '*/5 * * * *',
  $$SELECT public.expire_weather_control_recommendations();$$
);
