-- =============================================================================
-- RETENTION DRAFT — DO NOT schedule until explicit approval
-- decoded + raw: keep 30 days; older → detach/archive (decoded) / DELETE dry-run (raw)
-- See docs/DECODED_ROWCOUNT_PLAN.md · IOT_RETENTION_OPTIONS.md
-- =============================================================================

-- A) Decoded: after D1 partitions exist, detach months fully older than 30 days
-- Example (replace partition name after D1):
-- ALTER TABLE public.iot_room_state_decoded
--   DETACH PARTITION public.iot_room_state_decoded_p_2026_06;
-- ALTER TABLE public.iot_room_state_decoded_p_2026_06
--   SET SCHEMA archive;  -- or ATTACH to archive parent

-- B) Dry-run counts (safe SELECT)
-- SELECT count(*) FROM public.iot_room_state_decoded
-- WHERE mesure_at < now() - interval '30 days';
--
-- SELECT count(*) FROM public.iot_room_state_raw
-- WHERE received_at < now() - interval '30 days';

-- C) Raw retention (agreed: 30 days same as decoded) — DELETE only after approval
-- BEGIN;
-- DELETE FROM public.iot_room_state_raw
-- WHERE received_at < now() - interval '30 days';
-- -- review row count / RETURNING id LIMIT 5
-- ROLLBACK;

-- D) Suggested daily job (pseudo):
-- 1. SELECT partitions where upper bound < now() - 30 days
-- 2. DETACH each → rename into archive schema
-- 3. Log counts; never DROP in v1
