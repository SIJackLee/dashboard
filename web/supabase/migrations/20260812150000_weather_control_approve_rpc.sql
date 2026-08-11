-- Phase D — approve weather control recommendation (command scope)

CREATE OR REPLACE FUNCTION public.approve_weather_control_recommendation(
  p_id uuid,
  p_command_id uuid,
  p_approved_by uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_row public.weather_control_recommendation%ROWTYPE;
  v_can_command boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_approved_by THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row
  FROM public.weather_control_recommendation
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND OR v_row.status <> 'pending' THEN
    RETURN false;
  END IF;

  IF v_row.expires_at <= now() THEN
    RETURN false;
  END IF;

  SELECT
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.user_access ua
      WHERE ua.user_id = auth.uid()
        AND ua.lsind_regist_no = v_row.lsind_regist_no
        AND ua.item_code = v_row.item_code
        AND ua.can_read = true
        AND ua.can_command = true
    )
  INTO v_can_command;

  IF NOT v_can_command THEN
    RETURN false;
  END IF;

  UPDATE public.weather_control_recommendation
  SET
    status = 'approved',
    approved_at = now(),
    approved_by = p_approved_by,
    command_id = p_command_id,
    updated_at = now()
  WHERE id = p_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.approve_weather_control_recommendation IS
  'Phase D — pending weather recommendation approve + command link';

REVOKE ALL ON FUNCTION public.approve_weather_control_recommendation(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_weather_control_recommendation(uuid, uuid, uuid) TO authenticated;
