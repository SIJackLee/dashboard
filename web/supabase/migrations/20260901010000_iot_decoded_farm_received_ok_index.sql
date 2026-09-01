-- 오프라인 폴백(fetchLastKnownReadingsForFarm) statement timeout 해소.
--
-- 폴백 쿼리: WHERE lsind_regist_no=? AND item_code=? AND decode_status='ok'
--            ORDER BY received_at DESC LIMIT 500
--
-- 기존 인덱스는 모두 (lsind, item, module_uid, ...) 형태라 module_uid가 중간에
-- 끼어 (lsind,item)만으로는 received_at 정렬을 살리지 못한다. 그 결과 큰 파티션
-- (예: 2026_08 ~8만 행)을 Seq Scan + 전량 Sort → ~8초 timeout.
--
-- 이 부분 인덱스는 (lsind, item, received_at DESC)를 decode_status='ok' 조건으로
-- 만들어, 파티션별 인덱스 스캔(정렬 유지) + Merge Append + LIMIT 조기중단을 가능케
-- 한다. 쿼리 술어와 정확히 일치(부분 인덱스 predicate = decode_status='ok').
--
-- 롤백: DROP INDEX IF EXISTS public.idx_iot_decoded_farm_received_ok;

CREATE INDEX IF NOT EXISTS idx_iot_decoded_farm_received_ok
  ON public.iot_room_state_decoded (lsind_regist_no, item_code, received_at DESC)
  WHERE decode_status = 'ok';
