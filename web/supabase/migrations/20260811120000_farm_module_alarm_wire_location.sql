-- Wire 0x0C error v2 (8 B): stall_ty + stall_no + eqpmn_no + errcode
-- Legacy 5 B rows keep NULL location columns.

ALTER TABLE public.farm_module_alarm
  ADD COLUMN IF NOT EXISTS stall_ty_code text,
  ADD COLUMN IF NOT EXISTS stall_no text,
  ADD COLUMN IF NOT EXISTS eqpmn_no text,
  ADD COLUMN IF NOT EXISTS controller_key text,
  ADD COLUMN IF NOT EXISTS channel text;

COMMENT ON COLUMN public.farm_module_alarm.stall_ty_code IS
  'Wire error v2 — SP01.. from row byte (same as LIVE row[4])';
COMMENT ON COLUMN public.farm_module_alarm.stall_no IS
  'Wire error v2 — stall number (same as LIVE row[5])';
COMMENT ON COLUMN public.farm_module_alarm.eqpmn_no IS
  'Wire error v2 — controller/equipment number (same as LIVE row[6])';
COMMENT ON COLUMN public.farm_module_alarm.controller_key IS
  'SPxx:nn:nn composite for chart scope';
COMMENT ON COLUMN public.farm_module_alarm.channel IS
  'A/B/C derived from err_code high nibble; NULL for power loss';

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
  a.stall_ty_code,
  a.stall_no,
  a.eqpmn_no,
  a.controller_key,
  a.channel,
  a.status,
  a.received_at
FROM public.farm_module_alarm a
LEFT JOIN public.farm_location fl
  ON fl.lsind_regist_no = a.lsind_regist_no
 AND fl.item_code = a.item_code
WHERE a.status = 'active'
ORDER BY a.received_at DESC;

COMMENT ON VIEW public.v_farm_module_alarm_active IS
  'Active module alarms with farm_name and wire v2 location fields.';

GRANT SELECT ON public.v_farm_module_alarm_active TO authenticated;

-- Push body: farm · location · err_label
CREATE OR REPLACE FUNCTION public.enqueue_module_alarm_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_farm_name text;
  v_href text;
  v_body text;
  v_loc text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;

  SELECT fl.farm_name
  INTO v_farm_name
  FROM public.farm_location fl
  WHERE fl.lsind_regist_no = NEW.lsind_regist_no
  LIMIT 1;

  v_href := format(
    '/farm?lsind=%s&item=%s',
    NEW.lsind_regist_no,
    COALESCE(NEW.item_code, '')
  );

  v_body := COALESCE(NULLIF(trim(NEW.err_label), ''), '모듈 이상');

  IF NEW.stall_ty_code IS NOT NULL
     AND NEW.stall_no IS NOT NULL
     AND NEW.eqpmn_no IS NOT NULL THEN
    v_loc := trim(NEW.stall_ty_code) || ' ' || trim(NEW.stall_no)
      || '번 ' || trim(NEW.eqpmn_no) || '번';
    IF NEW.channel IS NOT NULL AND length(trim(NEW.channel)) > 0 THEN
      v_loc := v_loc || ' · ' || trim(NEW.channel) || '라인';
    END IF;
    v_body := v_loc || ' · ' || v_body;
  END IF;

  IF v_farm_name IS NOT NULL AND length(trim(v_farm_name)) > 0 THEN
    v_body := v_farm_name || ' · ' || v_body;
  END IF;

  INSERT INTO public.push_outbox (alarm_id, user_id, fcm_token, payload, status)
  SELECT
    NEW.id,
    d.user_id,
    d.fcm_token,
    jsonb_build_object(
      'title', '모듈 알람',
      'body', v_body,
      'alarmId', NEW.id::text,
      'lsind', NEW.lsind_regist_no,
      'itemCode', NEW.item_code,
      'farmName', v_farm_name,
      'href', v_href
    ),
    'pending'
  FROM public.user_push_device d
  WHERE d.platform = 'android'
    AND d.user_id IN (
      SELECT r.user_id
      FROM public.list_push_recipients(NEW.lsind_regist_no, NEW.item_code) r
    )
  ON CONFLICT (alarm_id, fcm_token) DO NOTHING;

  RETURN NEW;
END;
$$;
