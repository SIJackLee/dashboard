# 출고 품질 체크리스트 (단일 농장)

출고 직전 **깨지면 출고 불가**인 경로만 짧게 확인한다. 전수 UI 검수가 아니다.

## 전제

| 항목 | 값 |
| --- | --- |
| 앱 | `cd dashboard/web && npm run dev` → `http://localhost:3000` |
| LIVE | FARM01 / P00 시뮬 uplink 가동 |
| 구성 | 임신사 1ctrl(A·팬2) · 분만사 6ctrl(A+B) · 자돈사 6ctrl(A+B) |

### 테스트 계정

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| admin | `admin@test.com` | `admin1` |
| operator | `farmer@test.com` | `farmer` |
| viewer | `viewer@test.com` | `viewer` |

## 공통

- [ ] 로그인 → `/farm` 진입, FARM01 LIVE(임신/분만/자돈) 표시
- [ ] 빈 SP·위치만 농장이 제품 화면에 이질감 없이 처리
- [ ] DevTools / Next 이슈 배지에 **hydration mismatch 없음** (가능하면)

## admin

- [ ] `/farm` 허브: LIVE 그리드만 (위치만 농장 숨김/안내)
- [ ] Farm switcher: `LIVE` / `위치만` 뱃지 (해당 시)
- [ ] 헤더 **운영** → `/admin/ops` 시스템·사용자·농장 탭 로드
- [ ] 테마·모바일 미리보기 토글 동작, hydration 경고 없음

## operator

- [ ] 컨트롤러 설정온도 변경 → **적용** 활성 → 전송
- [ ] ACK → 현장 반영 완료(또는 동등 피드백) 체감
- [ ] 일괄 적용 UI 진입(선택·설정) 가능
- [ ] `/admin/ops` 등 운영 경로 차단 또는 `/farm`으로 복귀

## viewer

- [ ] 설정 패널 **조회 전용** 배너
- [ ] 적용/기본값 없음, 슬라이더·알람 잠금
- [ ] 일괄적용 없음 · 운영 메뉴 없음
- [ ] `/admin/ops` → `/farm` (또는 동등 차단)
- [ ] 명령이 실제로 나가지 않음

## 결과 기록

| 역할 | 결과 | 비고 |
| --- | --- | --- |
| admin | PASS (2026-07-22) | `/farm` LIVE 3축사 · `/admin/ops` 시스템·사용자·농장 · 테마/모바일 토글 OK |
| operator | PASS (2026-07-22) | 일괄적용 스위치 · `/admin/ops`→`/farm` · LIVE 표시 (단건 Apply는 이전 스모크에서 ACK 확인) |
| viewer | PASS (2026-07-22) | 일괄적용·운영 링크 없음 · 설정 **조회 전용** · 적용 버튼 없음 |

### Hydration 참고

- 앱 수정: viewport store가 모듈 로드 시 `localStorage`/`matchMedia`를 읽지 않음 → SSR과 첫 hydration 일치.
- Cursor IDE 브라우저가 주입하는 `data-cursor-ref`는 Next 이슈 배지에 **가짜 hydration**으로 잡힐 수 있음. **하드 네비게이션 직후** 배지 유무로 판정한다.

FAIL만 후속 수정 후보로 올린다.

## 관련

- 성능 기준: [`PERF_BASELINE.md`](./PERF_BASELINE.md)
- LIVE 측정: `npm run measure:live`
