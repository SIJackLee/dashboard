-- C harden: formal farm_name on View + ack/clear UPDATE (dashboard D prep)
-- INSERT remains Edge/service_role only (no INSERT policy for authenticated)
-- SMS/ARS notify path remains deferred

ALTER TABLE public.farm_module_alarm
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid REFERENCES auth.users (id);

COMMENT ON COLUMN public.farm_module_alarm.status_changed_at IS
  'When status moved to acked/cleared (dashboard ack path)';
COMMENT ON COLUMN public.farm_module_alarm.status_changed_by IS
  'auth.users id that ack/cleared the alarm';

DROP TRIGGER IF EXISTS farm_module_alarm_set_updated_at ON public.farm_module_alarm;
CREATE TRIGGER farm_module_alarm_set_updated_at
  BEFORE UPDATE ON public.farm_module_alarm
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS farm_module_alarm_update_status_scoped ON public.farm_module_alarm;
CREATE POLICY farm_module_alarm_update_status_scoped ON public.farm_module_alarm
  FOR UPDATE TO authenticated
  USING (
    public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  )
  WITH CHECK (
    public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
    AND status IN ('active', 'acked', 'cleared')
  );

DROP VIEW IF EXISTS public.v_farm_module_alarm_active;

CREATE VIEW public.v_farm_module_alarm_active
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.created_at,
  a.raw_id,
  a.lsind_regist_no,
  a.item_code,
  fl.farm_name,
  a.module_uid,
  a.topic,
  a.wire_ver,
  a.err_code,
  a.err_label,
  a.status,
  a.received_at
FROM public.farm_module_alarm a
LEFT JOIN public.farm_location fl
  ON fl.lsind_regist_no = a.lsind_regist_no
 AND fl.item_code = a.item_code
WHERE a.status = 'active'
ORDER BY a.received_at DESC;

COMMENT ON VIEW public.v_farm_module_alarm_active IS
  'Active module alarms with formal farm_name for dashboard (no client wire decode).';

GRANT SELECT ON public.v_farm_module_alarm_active TO authenticated;
GRANT SELECT ON public.farm_module_alarm TO authenticated;
