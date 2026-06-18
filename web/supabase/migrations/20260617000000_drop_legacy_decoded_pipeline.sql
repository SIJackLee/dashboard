-- RS-DB-C: drop legacy decoded/replay pipeline (D.py / S.py era)
-- Runtime path: RS.py → iot_room_state_raw → v_iot_raw_live → Dashboard TS decode

DROP VIEW IF EXISTS public.v_iot_replay_burst_summary;
DROP VIEW IF EXISTS public.v_iot_replay_controllers;
DROP VIEW IF EXISTS public.v_iot_replay_packets;
DROP VIEW IF EXISTS public.v_iot_decoded_controllers;
DROP VIEW IF EXISTS public.v_iot_decoded_packets;
DROP VIEW IF EXISTS public.v_iot_decoded_ctrl_flat;

DROP TRIGGER IF EXISTS trg_iot_decoded_mesure_at ON public.iot_room_state_decoded;

DROP POLICY IF EXISTS decoded_select_scoped ON public.iot_room_state_decoded;

DROP TABLE IF EXISTS public.iot_room_state_raw_failed;
DROP TABLE IF EXISTS public.iot_room_state_decoded;

DROP FUNCTION IF EXISTS public.sync_decoded_mesure_at() CASCADE;
