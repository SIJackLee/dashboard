-- Phase C1: stale sent (≥24h) → cancelled (P1)
-- HOT 90d DELETE not included (C2 deferred)

CREATE OR REPLACE FUNCTION public.cancel_stale_thermo_sent(age_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer := 0;
  hrs integer := GREATEST(COALESCE(age_hours, 24), 1);
BEGIN
  WITH u AS (
    UPDATE public.ctrl_thermo_command c
    SET
      status = 'cancelled',
      updated_at = now(),
      note = CASE
        WHEN c.note IS NULL OR btrim(c.note) = '' THEN 'stale_sent_24h'
        WHEN c.note LIKE '%stale_sent_24h%' THEN c.note
        ELSE left(c.note || ' | stale_sent_24h', 500)
      END,
      error_msg = CASE
        WHEN c.error_msg IS NULL OR btrim(c.error_msg) = '' THEN 'stale_sent_24h'
        WHEN c.error_msg LIKE '%stale_sent_24h%' THEN c.error_msg
        ELSE left(c.error_msg || ' | stale_sent_24h', 500)
      END
    WHERE c.status = 'sent'
      AND c.sent_at IS NOT NULL
      AND c.sent_at < now() - make_interval(hours => hrs)
    RETURNING c.id
  )
  SELECT count(*)::integer INTO n FROM u;

  RETURN jsonb_build_object(
    'ok', true,
    'cancelled', n,
    'age_hours', hrs,
    'ran_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.cancel_stale_thermo_sent(integer) IS
  'P1: sent older than age_hours → cancelled (stale_sent_24h). Phase C1.';

REVOKE ALL ON FUNCTION public.cancel_stale_thermo_sent(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_stale_thermo_sent(integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.cancel_stale_thermo_sent(integer) TO service_role;

-- Daily cron (19:00 UTC ≈ 04:00 KST). Idempotent if job already exists on re-apply.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cancel-stale-thermo-sent-daily'
  ) THEN
    PERFORM cron.schedule(
      'cancel-stale-thermo-sent-daily',
      '0 19 * * *',
      $cmd$SELECT public.cancel_stale_thermo_sent(24)$cmd$
    );
  END IF;
END;
$$;
