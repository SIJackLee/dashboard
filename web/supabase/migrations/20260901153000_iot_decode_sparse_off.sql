-- PoC sparse OFF (2026-09-01): LIVE·델린 신선도 side effect 기각.
-- decode-batch는 sparse_enabled=false 시 모든 raw를 decoded upsert.
-- Rollback: UPDATE iot_decode_config SET sparse_enabled = true WHERE id = 1;

UPDATE public.iot_decode_config
SET sparse_enabled = false
WHERE id = 1;

COMMENT ON COLUMN public.iot_decode_config.sparse_enabled IS
  'Edge decode-batch sparse gate. false = every raw → decoded (PoC OFF 2026-09-01).';
