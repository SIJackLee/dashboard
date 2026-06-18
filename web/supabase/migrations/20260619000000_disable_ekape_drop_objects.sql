-- Ekape export pipeline disabled (uplink-only policy).
-- Keeps: iot_room_state_raw, v_iot_raw_live, ctrl_thermo_command, auth tables.

DROP VIEW IF EXISTS public.v_ekape_export_row;
DROP VIEW IF EXISTS public.v_iot_ctrl_latest;

DROP TABLE IF EXISTS public.ekape_export_cursor;
DROP TABLE IF EXISTS public.ekape_export_config;
DROP TABLE IF EXISTS public.ekape_mesure_val_lut;
DROP TABLE IF EXISTS public.iot_ctrl_decoded_snapshot;

-- Piggy legacy duplicate (dashboard uses game_high_scores)
DROP TABLE IF EXISTS public.high_scores;

DROP FUNCTION IF EXISTS public.ekape_device_on(text);
DROP FUNCTION IF EXISTS public.ekape_json_elem_text(jsonb, text[]);
DROP FUNCTION IF EXISTS public.ekape_text_or_empty(text);
DROP FUNCTION IF EXISTS public.ekape_esntl_sn(text, text, text);
