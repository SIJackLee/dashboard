-- D-slim A: drop unused iot_room_state_decoded columns
-- session_id / chunk_seq / lut_ver / crc_ok — recent rows all-null; views do not select them.
-- fan_supply_pct deferred (trend RPC / list still expose the column).
-- Applied on iot-cloud 2026-08-05.

ALTER TABLE public.iot_room_state_decoded DROP COLUMN IF EXISTS session_id;
ALTER TABLE public.iot_room_state_decoded DROP COLUMN IF EXISTS chunk_seq;
ALTER TABLE public.iot_room_state_decoded DROP COLUMN IF EXISTS lut_ver;
ALTER TABLE public.iot_room_state_decoded DROP COLUMN IF EXISTS crc_ok;
