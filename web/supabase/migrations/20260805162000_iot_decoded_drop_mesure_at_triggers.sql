-- D1 follow-up: drop mesure_at triggers (partition clones moved rows on upsert).
-- Edge decode-batch now always sends mesure_at. Applied on iot-cloud 2026-08-05.

DROP TRIGGER IF EXISTS trg_iot_decoded_mesure_at ON public.iot_room_state_decoded;
DROP TRIGGER IF EXISTS trg_iot_decoded_mesure_at ON public.iot_room_state_decoded_p_2026_07;
DROP TRIGGER IF EXISTS trg_iot_decoded_mesure_at ON public.iot_room_state_decoded_p_2026_08;
DROP TRIGGER IF EXISTS trg_iot_decoded_mesure_at ON public.iot_room_state_decoded_p_2026_09;
DROP TRIGGER IF EXISTS trg_iot_decoded_mesure_at ON public.iot_room_state_decoded_p_2026_10;
DROP TRIGGER IF EXISTS trg_iot_decoded_mesure_at ON public.iot_room_state_decoded_p_default;
DROP TRIGGER IF EXISTS trg_iot_decoded_mesure_at ON public.iot_room_state_decoded_legacy;

COMMENT ON FUNCTION public.sync_decoded_mesure_at() IS
  'Legacy helper; D1 Edge sends mesure_at. Triggers dropped to avoid partition-move on upsert.';
