-- D1 follow-up: partition key must not change on UPDATE (upsert).
-- Applied on iot-cloud 2026-08-05 with D1 swap.

CREATE OR REPLACE FUNCTION public.sync_decoded_mesure_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Partition key: never change mesure_at on UPDATE (PG cannot move rows).
  IF TG_OP = 'UPDATE' THEN
    NEW.mesure_at := OLD.mesure_at;
    RETURN NEW;
  END IF;

  IF NEW.mesure_dt IS NOT NULL AND NEW.mesure_dt ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$' THEN
    NEW.mesure_at := public.parse_kst_timestamp(NEW.mesure_dt);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_decoded_mesure_at() IS
  'Sets mesure_at from mesure_dt on INSERT only; locks mesure_at on UPDATE for partitioned decoded.';
