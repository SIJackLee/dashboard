-- L3 Android push: device tokens + outbox (FCM). SMS path (farm_alarm_notify) untouched.
-- Apply to remote only after explicit approval.

-- ---------------------------------------------------------------------------
-- user_push_device
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_push_device (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  platform text NOT NULL
    CHECK (platform IN ('android', 'ios')),
  fcm_token text NOT NULL,
  app_id text,
  device_label text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_push_device_fcm_token_key UNIQUE (fcm_token)
);

CREATE INDEX IF NOT EXISTS user_push_device_user_platform_idx
  ON public.user_push_device (user_id, platform);

COMMENT ON TABLE public.user_push_device IS
  'FCM device tokens for Capacitor push (phase1: android).';

DROP TRIGGER IF EXISTS user_push_device_set_updated_at ON public.user_push_device;
CREATE TRIGGER user_push_device_set_updated_at
  BEFORE UPDATE ON public.user_push_device
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_push_device ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_push_device_select_own ON public.user_push_device;
CREATE POLICY user_push_device_select_own ON public.user_push_device
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_push_device_insert_own ON public.user_push_device;
CREATE POLICY user_push_device_insert_own ON public.user_push_device
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_push_device_update_own ON public.user_push_device;
CREATE POLICY user_push_device_update_own ON public.user_push_device
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_push_device_delete_own ON public.user_push_device;
CREATE POLICY user_push_device_delete_own ON public.user_push_device
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_push_device TO authenticated;

-- ---------------------------------------------------------------------------
-- push_outbox (worker-only; RLS on, no policies)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  alarm_id uuid NOT NULL REFERENCES public.farm_module_alarm (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  CONSTRAINT push_outbox_alarm_token_key UNIQUE (alarm_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS push_outbox_pending_idx
  ON public.push_outbox (created_at ASC)
  WHERE status = 'pending';

COMMENT ON TABLE public.push_outbox IS
  'FCM dispatch queue for module alarms. Written by trigger; drained by push-dispatch.';

DROP TRIGGER IF EXISTS push_outbox_set_updated_at ON public.push_outbox;
CREATE TRIGGER push_outbox_set_updated_at
  BEFORE UPDATE ON public.push_outbox
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Recipients: farm readers + admins
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_push_recipients(
  p_lsind_regist_no text,
  p_item_code text
)
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT x.user_id
  FROM (
    SELECT ua.user_id
    FROM public.user_access ua
    WHERE ua.lsind_regist_no = p_lsind_regist_no
      AND ua.item_code IS NOT DISTINCT FROM p_item_code
      AND ua.can_read = true
    UNION
    SELECT p.user_id
    FROM public.profiles p
    WHERE public.is_admin(p.user_id)
  ) x;
$$;

COMMENT ON FUNCTION public.list_push_recipients(text, text) IS
  'Users eligible for farm module-alarm push (can_read + admins).';

REVOKE ALL ON FUNCTION public.list_push_recipients(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_push_recipients(text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- Enqueue on active module alarm
-- ---------------------------------------------------------------------------
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

DROP TRIGGER IF EXISTS farm_module_alarm_enqueue_push ON public.farm_module_alarm;
CREATE TRIGGER farm_module_alarm_enqueue_push
  AFTER INSERT OR UPDATE OF status ON public.farm_module_alarm
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_module_alarm_push();

COMMENT ON FUNCTION public.enqueue_module_alarm_push() IS
  'Enqueue FCM outbox rows for android tokens when module alarm becomes active.';
