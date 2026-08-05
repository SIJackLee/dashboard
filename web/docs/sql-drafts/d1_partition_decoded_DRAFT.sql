-- =============================================================================
-- D1 DRAFT ONLY — DO NOT apply_migration / run on iot-cloud until explicit OK
-- Partition iot_room_state_decoded by RANGE (mesure_at) monthly
-- HOT = last 30 days (all retained partitions); older months detach→archive
-- See docs/DECODED_ROWCOUNT_PLAN.md
-- =============================================================================

-- 0) Preconditions (manual):
--    - maintenance window
--    - backup / point-in-time
--    - Edge decode paused or lag acceptable
--    - Verify PG version FK-to-partitioned rules

BEGIN;

-- 1) Archive stub (identical columns as current decoded — adjust if schema drifted)
CREATE TABLE IF NOT EXISTS public.iot_room_state_decoded_archive (
  LIKE public.iot_room_state_decoded INCLUDING DEFAULTS INCLUDING CONSTRAINTS
);

-- 2) New partitioned parent (identity/PK strategy: use raw_id as PK candidate
--    OR keep id generated on children — pick one before run.
--    Below sketch uses BIGSERIAL on parent via OVERRIDE — REVIEW BEFORE RUN.

CREATE TABLE public.iot_room_state_decoded_p (
  LIKE public.iot_room_state_decoded INCLUDING DEFAULTS INCLUDING GENERATED INCLUDING COMMENTS
) PARTITION BY RANGE (mesure_at);

-- Example month partitions (extend as needed)
CREATE TABLE public.iot_room_state_decoded_p_2026_07
  PARTITION OF public.iot_room_state_decoded_p
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE public.iot_room_state_decoded_p_2026_08
  PARTITION OF public.iot_room_state_decoded_p
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE public.iot_room_state_decoded_p_2026_09
  PARTITION OF public.iot_room_state_decoded_p
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

-- 3) Copy data
INSERT INTO public.iot_room_state_decoded_p
SELECT * FROM public.iot_room_state_decoded;

-- 4) Recreate indexes on PARENT (propagate) — names must not collide
-- CREATE INDEX ... ON public.iot_room_state_decoded_p (...);
-- UNIQUE (raw_id) must include mesure_at on PG partitioned UNIQUE rules
--   e.g. UNIQUE (raw_id, mesure_at) OR unique index per partition only

-- 5) Recreate triggers fill_keys + mesure_at on parent

-- 6) Swap
-- ALTER TABLE public.iot_room_state_decoded RENAME TO iot_room_state_decoded_legacy;
-- ALTER TABLE public.iot_room_state_decoded_p RENAME TO iot_room_state_decoded;
-- Recreate views v_iot_* against new name
-- Re-bind RLS policies

-- 7) Detach helper (retention job later)
-- ALTER TABLE public.iot_room_state_decoded DETACH PARTITION ...;
-- ALTER TABLE ... RENAME / attach to archive

ROLLBACK; -- draft ends in rollback; replace with COMMIT only after review
