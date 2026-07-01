# 기상청 API PoC 결과 (KMA Weather Warning)

> PoC 스크립트: `scripts/kma/poc-kma-warn-status.mjs`  
> 최종 판정은 `scripts/kma/poc-results.json`의 `goNoGo` 필드 참고.

## 결론: **CONDITIONAL GO (특보 조회 live OK)**

| 항목 | 결과 |
|------|------|
| API 게이트웨이 | `https://apis.data.go.kr` 접근 가능 |
| MVP operation | `getPwnStatus` — **live `resultCode=00` 확인** (2026-06-26) |
| 인증 파라미터 | **`serviceKey` (소문자)** — `ServiceKey`는 HTTP 401 |
| 비용·승인 | 무료, WthrWrnInfoService **승인됨** |
| SI1 `farm_location` | 이름 fallback 매칭 **동작** (live PoC FARM01 1건) |
| REG_ID map | **194/228 (85%)** — `getFcstZoneCd`에 **`regSp=A`** 필수 (미지정 시 403) |

**판정:** **GO** — live 특보 조회 + REG_ID 매칭률 ≥80%

**No-Go 조건:** live 호출 `resultCode != 00` 지속, REG_ID 매칭률 < 80% (FcstZone 빌드 후).

---

## 실행 방법

```bash
cd dashboard/web

# 1) 키 발급 — scripts/kma/apply-data-go-kr.md
# 2) .env.local → DATA_GO_KR_SERVICE_KEY=

npm run build:kma-wrn-map    # REG_ID ↔ sigungu (FcstZone API)
npm run poc:kma-weather        # live PoC
npm run poc:kma-weather:offline  # fixture 매칭 로직만
```

---

## 아키텍처 (본 구현 시)

```
data.go.kr getPwnStatus (10~30분 Cron)
  → weather_warn_cache (Supabase)
  → farm_location.sido/sigungu + wrn-reg-id-map
  → UI: AlarmBell 「기상 특보」 섹션 (센서 알람과 분리)
```

센서 알람(`deriveAlarmsFromReadings`)과 **혼합하지 않음**.

---

## 산출물

| 파일 | 설명 |
|------|------|
| [scripts/kma/kma-api-config.mjs](../scripts/kma/kma-api-config.mjs) | 엔드포인트·상수 |
| [scripts/kma/kma-api-client.mjs](../scripts/kma/kma-api-client.mjs) | fetch·parse |
| [scripts/kma/kma-wrn-match.mjs](../scripts/kma/kma-wrn-match.mjs) | 농장↔특보 매칭 |
| [scripts/kma/build-wrn-reg-id-map.mjs](../scripts/kma/build-wrn-reg-id-map.mjs) | REG_ID map 빌드 |
| [scripts/kma/wrn-reg-id-map.json](../scripts/kma/wrn-reg-id-map.json) | 생성된 매핑 |
| [scripts/kma/poc-results.json](../scripts/kma/poc-results.json) | 최근 PoC JSON |
| [scripts/kma/apply-data-go-kr.md](../scripts/kma/apply-data-go-kr.md) | 키 발급 가이드 |

---

## 법·운영

- 공공눈리 **제1유형** — UI에 **「출처: 기상청」** 표기
- `DATA_GO_KR_SERVICE_KEY`는 **서버 전용** (`.env.example` 참고)
- API 장애 시 센서 알람은 독립 유지

---

## 다음 단계 (본 구현 — 별도 승인)

1. ~~Edge/Cron + `weather_warn_cache` 테이블~~ **완료** — `fetch-weather-warn` Edge, 15분 Cron
2. ~~`AlarmBellMenu` 기상 특보 섹션~~ **완료** — `weather-warnings.ts` + `AlarmBellMenu`
3. Admin `/farm` 구역별 특보 아이콘 (선택)

### 배포 체크리스트

| 단계 | 상태 |
|------|------|
| 1) migration `weather_warn_cache` | ✅ 원격 적용 (`20260626055835`) |
| 2) Edge `fetch-weather-warn` 배포 | ✅ `verify_jwt=false` |
| 3) pg_cron `fetch-weather-warn-15m` | ✅ 15분 주기 |
| 4) 초기 캐시 (`npm run refresh:weather-warn`) | ✅ `fetch_ok=true`, `result_code=00` |
| 5) Edge secrets `DATA_GO_KR_SERVICE_KEY` | ✅ Dashboard 설정 완료 (Edge 호출 검증 `ok=true`) |
