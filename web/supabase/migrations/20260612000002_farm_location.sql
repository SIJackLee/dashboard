-- Farm geographic location (user-configured, keyed by lsind + item_code)

CREATE TABLE IF NOT EXISTS public.farm_location (
  lsind_regist_no text NOT NULL,
  item_code text NOT NULL,
  sido text NOT NULL,
  sigungu text NOT NULL,
  address_detail text,
  address_text text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geocode_source text NOT NULL DEFAULT 'region_lookup',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (lsind_regist_no, item_code),
  CONSTRAINT farm_location_lat_chk CHECK (lat BETWEEN 33 AND 39),
  CONSTRAINT farm_location_lng_chk CHECK (lng BETWEEN 124 AND 132)
);

CREATE INDEX IF NOT EXISTS idx_farm_location_sido_sigungu
  ON public.farm_location (sido, sigungu);

COMMENT ON TABLE public.farm_location IS
  '농장 위치 — lsindRegistNo+itemCode, 설정 또는 시드';
COMMENT ON COLUMN public.farm_location.address_text IS
  '표시용 전체 주소 (시도 + 시군구 + 상세)';

ALTER TABLE public.farm_location ENABLE ROW LEVEL SECURITY;

CREATE POLICY farm_location_select ON public.farm_location
  FOR SELECT TO authenticated
  USING (
    public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  );

CREATE POLICY farm_location_insert ON public.farm_location
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  );

CREATE POLICY farm_location_update ON public.farm_location
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    OR public.user_can_read_farm(auth.uid(), lsind_regist_no, item_code)
  );

CREATE POLICY farm_location_delete ON public.farm_location
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));
