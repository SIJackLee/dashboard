-- ARIA 턴 로그 — 라우팅 오분류 추적 (질문·route·depth)
CREATE TABLE IF NOT EXISTS public.aria_turn_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lsind_regist_no text,
  item_code text,
  question text NOT NULL,
  route text NOT NULL,
  depth smallint,
  source text,
  session_depth_in smallint,
  session_route_in text,
  session_depth_out smallint,
  session_route_out text,
  answer_preview text,
  protocol_v1 boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_aria_turn_log_created_at
  ON public.aria_turn_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_aria_turn_log_route_created
  ON public.aria_turn_log (route, created_at DESC);

COMMENT ON TABLE public.aria_turn_log IS
  'ARIA 음성/텍스트 턴 로그 — 오분류 검수용. 답변 전문 미저장.';
COMMENT ON COLUMN public.aria_turn_log.answer_preview IS
  '답변 앞부분만 (미리보기)';

ALTER TABLE public.aria_turn_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY aria_turn_log_insert ON public.aria_turn_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY aria_turn_log_select ON public.aria_turn_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY aria_turn_log_delete ON public.aria_turn_log
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
