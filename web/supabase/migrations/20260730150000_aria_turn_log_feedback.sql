-- ARIA 턴 로그 맞음/틀림 피드백
ALTER TABLE public.aria_turn_log
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS feedback_at timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_by uuid REFERENCES auth.users (id);

ALTER TABLE public.aria_turn_log
  DROP CONSTRAINT IF EXISTS aria_turn_log_feedback_chk;

ALTER TABLE public.aria_turn_log
  ADD CONSTRAINT aria_turn_log_feedback_chk
  CHECK (feedback IS NULL OR feedback IN ('ok', 'bad'));

COMMENT ON COLUMN public.aria_turn_log.feedback IS
  '검수 라벨: ok=맞음, bad=틀림, NULL=미검수';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'aria_turn_log'
      AND policyname = 'aria_turn_log_update'
  ) THEN
    CREATE POLICY aria_turn_log_update ON public.aria_turn_log
      FOR UPDATE TO authenticated
      USING (public.is_admin(auth.uid()))
      WITH CHECK (public.is_admin(auth.uid()));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_aria_turn_log_feedback
  ON public.aria_turn_log (feedback, created_at DESC);
