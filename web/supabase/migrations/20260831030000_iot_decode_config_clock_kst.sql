-- decode-batch clock 보정: KST wall-clock을 UTC epoch로 stuffing하는 실장비 허용목록.
-- 목록에 있는 소스는 live/replay 무관하게 -9h를 항상 적용(지연 재전송 burst 교정).
-- 기본값 '{}' → 미지정 소스는 기존 future-only 휴리스틱 유지(파일럿 UTC 무영향).
alter table public.iot_decode_config
  add column if not exists clock_kst_farm_keys text[] not null default '{}'::text[];

comment on column public.iot_decode_config.clock_kst_farm_keys is
  'KST-stuffed 펌웨어 소스 허용목록. "FARM02" 또는 "FARM02/P00" 형식. 목록 소스는 mesure_at에 항상 -9h 적용.';

-- 분류 쿼리(14일 raw epoch-received 분포) 결과: FARM02/FARM03 = KST-stuffed, FARM01 = 시뮬레이터 UTC(제외).
update public.iot_decode_config
  set clock_kst_farm_keys = array['FARM02', 'FARM03'],
      updated_at = now()
  where id = 1;
