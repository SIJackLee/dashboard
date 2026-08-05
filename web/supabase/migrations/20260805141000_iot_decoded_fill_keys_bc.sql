-- D-slim B+C: derive farm keys from topic, stall/eqpmn from controller_key
-- Physical columns kept for indexes / list views / Edge (may still send them).
-- Applied on iot-cloud 2026-08-05.
-- Verified via failed test INSERT DETAIL row already showing SLIMTEST/P88/SP09:02:03 fills.

CREATE OR REPLACE FUNCTION public.iot_decoded_fill_keys()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  topic_parts text[];
  key_parts text[];
BEGIN
  -- B: topic = sungil/{lsind}/{item}/raw
  IF NEW.topic IS NOT NULL AND NEW.topic <> '' THEN
    topic_parts := string_to_array(NEW.topic, '/');
    IF array_length(topic_parts, 1) >= 4
       AND topic_parts[1] = 'sungil'
       AND topic_parts[4] = 'raw' THEN
      IF NEW.lsind_regist_no IS NULL OR NEW.lsind_regist_no = '' THEN
        NEW.lsind_regist_no := topic_parts[2];
      END IF;
      IF NEW.item_code IS NULL OR NEW.item_code = '' THEN
        NEW.item_code := topic_parts[3];
      END IF;
    END IF;
  END IF;

  -- C: controller_key = {stall_ty}:{stall_no}:{eqpmn}
  IF NEW.controller_key IS NOT NULL AND NEW.controller_key <> '' THEN
    key_parts := string_to_array(NEW.controller_key, ':');
    IF array_length(key_parts, 1) >= 3 THEN
      IF NEW.stall_ty_code IS NULL OR NEW.stall_ty_code = '' THEN
        NEW.stall_ty_code := key_parts[1];
      END IF;
      IF NEW.stall_no IS NULL OR NEW.stall_no = '' THEN
        NEW.stall_no := key_parts[2];
      END IF;
      IF NEW.eqpmn_no IS NULL OR NEW.eqpmn_no = '' THEN
        NEW.eqpmn_no := key_parts[3];
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_iot_decoded_fill_keys ON public.iot_room_state_decoded;
CREATE TRIGGER trg_iot_decoded_fill_keys
  BEFORE INSERT OR UPDATE ON public.iot_room_state_decoded
  FOR EACH ROW
  EXECUTE FUNCTION public.iot_decoded_fill_keys();

ALTER TABLE public.iot_room_state_decoded
  ALTER COLUMN lsind_regist_no SET DEFAULT '',
  ALTER COLUMN item_code SET DEFAULT '',
  ALTER COLUMN stall_ty_code SET DEFAULT '',
  ALTER COLUMN stall_no SET DEFAULT '',
  ALTER COLUMN eqpmn_no SET DEFAULT '';
