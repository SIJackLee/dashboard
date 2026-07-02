-- Admin global LIVE / farm overview RLS timeout mitigation
-- Partial index matches v_iot_dashboard_list WHERE clause

CREATE INDEX IF NOT EXISTS idx_iot_decoded_live_list_scope
  ON public.iot_room_state_decoded (
    lsind_regist_no,
    item_code,
    received_at DESC
  )
  WHERE packet_mode = 'live'
    AND decode_status = 'ok'
    AND wire_ver = 12;

COMMENT ON INDEX public.idx_iot_decoded_live_list_scope IS
  'Farm-scoped + overview aggregate — v_iot_dashboard_list hot path';
