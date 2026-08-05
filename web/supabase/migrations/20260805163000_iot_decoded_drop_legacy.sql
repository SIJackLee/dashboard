-- Drop D1 rollback copy after soak. Applied 2026-08-05 (explicit approval).

DROP TABLE IF EXISTS public.iot_room_state_decoded_legacy CASCADE;
DROP SEQUENCE IF EXISTS public.iot_room_state_decoded_legacy_id_seq;

COMMENT ON TABLE public.iot_room_state_decoded IS
  'D1 partitioned by mesure_at (monthly). UNIQUE(raw_id, mesure_at). Legacy dropped 2026-08-05.';
