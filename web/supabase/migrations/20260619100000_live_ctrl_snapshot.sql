-- LIVE controller snapshot: 1 row per (farm, module, controller_key).
-- Filled by RSD/live_snapshot.py from iot_room_state_raw (wire_decode).
-- Dashboard reads v_iot_live_latest instead of decoding v_iot_raw_live stream.

CREATE TABLE IF NOT EXISTS public.iot_live_ctrl_snapshot (
  lsind_regist_no text NOT NULL,
  item_code text NOT NULL,
  module_uid smallint NOT NULL,
  controller_key text NOT NULL,
  raw_id bigint NOT NULL REFERENCES public.iot_room_state_raw (id) ON DELETE CASCADE,
  wire_ver smallint NOT NULL,
  packet_mode text NOT NULL DEFAULT 'live',
  mesure_dt text NOT NULL,
  received_at timestamptz NOT NULL,
  decoded_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lsind_regist_no, item_code, module_uid, controller_key)
);

CREATE INDEX IF NOT EXISTS idx_iot_live_ctrl_snapshot_farm_received
  ON public.iot_live_ctrl_snapshot (lsind_regist_no, item_code, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_iot_live_ctrl_snapshot_raw
  ON public.iot_live_ctrl_snapshot (raw_id);

COMMENT ON TABLE public.iot_live_ctrl_snapshot IS
  'LIVE controller decode snapshot — 1 row per controller; UPSERT by live_snapshot.py';

ALTER TABLE public.iot_live_ctrl_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY iot_live_ctrl_snapshot_select ON public.iot_live_ctrl_snapshot
  FOR SELECT TO authenticated
  USING (
    public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  );

CREATE OR REPLACE VIEW public.v_iot_live_latest AS
SELECT
  s.lsind_regist_no,
  s.item_code,
  s.module_uid,
  s.controller_key,
  s.raw_id,
  s.wire_ver,
  s.packet_mode,
  s.mesure_dt,
  s.received_at,
  s.decoded_json,
  s.updated_at
FROM public.iot_live_ctrl_snapshot s
WHERE s.packet_mode = 'live';

COMMENT ON VIEW public.v_iot_live_latest IS
  'LIVE snapshot per controller — Dashboard primary read path';

GRANT SELECT ON public.v_iot_live_latest TO authenticated;
