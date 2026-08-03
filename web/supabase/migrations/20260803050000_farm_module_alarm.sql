-- farm_module_alarm: module error uplink (wire 0x0C 5B) → Alarm store for dashboard View
-- Edge decode-batch writes; dashboard reads via v_farm_module_alarm_active
-- SMS/ARS notify path remains deferred

CREATE TABLE IF NOT EXISTS public.farm_module_alarm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  raw_id bigint REFERENCES public.iot_room_state_raw (id) ON DELETE SET NULL,
  lsind_regist_no text NOT NULL,
  item_code text,
  module_uid integer,
  topic text,
  wire_ver integer NOT NULL DEFAULT 12,
  err_code smallint NOT NULL,
  err_label text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'acked', 'cleared')),
  received_at timestamptz NOT NULL,
  decoded_json jsonb,
  CONSTRAINT farm_module_alarm_raw_id_key UNIQUE (raw_id)
);

CREATE INDEX IF NOT EXISTS farm_module_alarm_farm_received_idx
  ON public.farm_module_alarm (lsind_regist_no, received_at DESC);

CREATE INDEX IF NOT EXISTS farm_module_alarm_active_idx
  ON public.farm_module_alarm (lsind_regist_no, status, received_at DESC)
  WHERE status = 'active';

COMMENT ON TABLE public.farm_module_alarm IS
  'Module wire error uplink (5B 0x0C/0x02). Dashboard reads View; no client-side wire decode.';

ALTER TABLE public.farm_module_alarm ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS farm_module_alarm_select_scoped ON public.farm_module_alarm;
CREATE POLICY farm_module_alarm_select_scoped ON public.farm_module_alarm
  FOR SELECT TO authenticated
  USING (
    public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  );

-- security_invoker: RLS of underlying table applies to caller
CREATE OR REPLACE VIEW public.v_farm_module_alarm_active
WITH (security_invoker = true)
AS
SELECT
  id,
  created_at,
  raw_id,
  lsind_regist_no,
  item_code,
  module_uid,
  topic,
  wire_ver,
  err_code,
  err_label,
  status,
  received_at
FROM public.farm_module_alarm
WHERE status = 'active'
ORDER BY received_at DESC;

COMMENT ON VIEW public.v_farm_module_alarm_active IS
  'Active module alarms for dashboard (no wire interpretation on client).';

GRANT SELECT ON public.v_farm_module_alarm_active TO authenticated;
GRANT SELECT ON public.farm_module_alarm TO authenticated;
