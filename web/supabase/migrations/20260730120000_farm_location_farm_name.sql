-- 농장 표시명 (ARIA·UI에서 부름). 없으면 farmShortLabel 폴백.
ALTER TABLE public.farm_location
  ADD COLUMN IF NOT EXISTS farm_name text;

COMMENT ON COLUMN public.farm_location.farm_name IS
  '사용자 지정 농장 이름 — AI/UI 표시용. NULL이면 등록번호·축종 라벨 사용';
