-- =============================================================================
-- RETENTION — applied 2026-08-05 (schedule ON)
-- Function: public.cleanup_iot_retention_30d(days, raw_batch)
-- Cron: cleanup-iot-retention-30d-daily @ 30 18 * * * (03:30 KST)
-- See docs/DECODED_ROWCOUNT_PLAN.md · migration 20260805170000_*
-- =============================================================================

-- Manual run:
-- SELECT public.cleanup_iot_retention_30d(30, 10000);

-- Behavior:
-- 1) Detach decoded month partitions whose UPPER bound <= now()-30d
--    → schema archive, drop raw FK, rename *_archived
-- 2) DELETE raw WHERE received_at < cutoff LIMIT batch (default 10000)
-- 3) Never DROP partitions in v1

-- Dry-run counts:
-- SELECT count(*) FROM public.iot_room_state_decoded WHERE mesure_at < now() - interval '30 days';
-- SELECT count(*) FROM public.iot_room_state_raw WHERE received_at < now() - interval '30 days';
