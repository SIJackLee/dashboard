-- Sparse PoC allowlist expand: FARM01 + FARM02 (approved 2026-08-05).

UPDATE public.iot_decode_config
SET sparse_farm_keys = ARRAY['FARM01/P00', 'FARM02/P00']::text[]
WHERE id = 1;
