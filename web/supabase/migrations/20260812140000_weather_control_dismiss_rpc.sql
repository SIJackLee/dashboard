-- Phase C — dismiss weather control recommendation (authenticated RPC)

CREATE OR REPLACE FUNCTION public.dismiss_weather_control_recommendation(p_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row public.weather_control_recommendation%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row
  FROM public.weather_control_recommendation
  WHERE id = p_id;

  IF NOT FOUND OR v_row.status <> 'pending' THEN
    RETURN false;
  END IF;

  IF NOT public.user_can_read_farm(
    auth.uid(),
    v_row.lsind_regist_no,
    v_row.item_code
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.weather_control_recommendation
  SET
    status = 'dismissed',
    dismissed_at = now(),
    updated_at = now()
  WHERE id = p_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.dismiss_weather_control_recommendation IS
  'Phase C — pending weather recommendation dismiss (farm read scope)';

REVOKE ALL ON FUNCTION public.dismiss_weather_control_recommendation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_weather_control_recommendation(uuid) TO authenticated;
