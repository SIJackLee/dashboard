-- Remove empty public stub; real retention uses schema archive.
-- Approved 2026-08-05.

DROP TABLE IF EXISTS public.iot_room_state_decoded_archive;

COMMENT ON SCHEMA archive IS
  'Detached decoded month partitions from cleanup_iot_retention_30d.';
