-- 축사 메타데이터 등 UI 설정 (사용자별, profiles.ui_config jsonb)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ui_config jsonb NOT NULL DEFAULT '{"barns":[]}'::jsonb;

COMMENT ON COLUMN public.profiles.ui_config IS '사용자 UI 설정 (barns: 축사 메타데이터 배열)';

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
