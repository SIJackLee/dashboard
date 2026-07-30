# 허브 본체 안정화 — P0 (관측·재현 게이트)

> 정본 URL 계약: [`farm-hub-url.md`](./farm-hub-url.md)  
> P0 범위: **앱 동작 변경 없이** 회귀 게이트·체크리스트·관측 절차만 고정.

---

## 자동 게이트 (서버 불필요)

```bash
cd dashboard/web
npm run verify:hub
```

| 파일 | 커버 |
|------|------|
| `src/lib/farm/farm-hub-url-smoke.test.ts` | 차트 딥링크 · soft home · 기간+탭 유지 · 탭 URL 왕복 · 농장 전환 drill 클리어 |
| `src/lib/farm/farm-hub-keepalive.test.ts` | TTL · 슬라이드 중 언마운트 금지 · 농장 flush 플래그 |

`npm test`에도 포함됨. 허브 작업 중에는 `verify:hub`만 먼저 돌려도 된다.

---

## 브라우저 스모크 (dev 또는 배포)

```bash
# 로컬: npm run dev 실행 중
npm run smoke:hub-url

# 배포본
UI_VERIFY_BASE=https://<preview-or-prod>.vercel.app npm run smoke:hub-url
```

스크립트: `scripts/farm-hub-url-manual-smoke.mjs`  
전제: `.env.local` Supabase = 배포 env · 테스트 계정.

| # | 시나리오 | 자동화 |
|---|----------|--------|
| 1 | 차트 딥링크 · 새로고침 | ✓ |
| 2 | 로고 soft home | ✓ |
| 3 | 기간 변경 시 차트 유지 | ✓ |
| 4 | `listMode=channel` → graph | ✓ |
| 5 | 탭 왕복 그리드↔목록↔차트↔ARIA | ✓ |

---

## 수동 관측 체크리스트 (P0)

허브 작업 전·후 한 번씩. 실패 시 URL·네트워크·콘솔을 기록하고 **P1에서 수정**.

| # | 항목 | 확인 |
|---|------|------|
| M1 | 탭×4 왕복 후 URL·활성 패널 일치 | `smoke:hub-url` #5 또는 수동 |
| M2 | soft home (로고 / 모바일 모니터링) | #2 |
| M3 | 기간만 변경 — 탭·chart 범위 유지 | #3 |
| M4 | 차트 딥링크 새로고침 | #1 |
| M5 | 농장 전환(admin) — drill/탭 초기화·기간 유지 | 수동 · 유닛 smoke 5 |
| M6 | 탭 숨김 → 복귀 — LIVE 폴링 폭주 없음 | 아래 관측 |
| M7 | 목록·차트·ARIA 방문 후 그리드만 — 메모리/네트워크 이상 없음 | DevTools |

### M6 · M7 관측 방법

1. Chrome DevTools → Network (Fetch/XHR) · Performance/Memory  
2. `/farm` 로그인 → 목록·차트 각 1회 진입 후 그리드로 복귀  
3. 다른 앱 탭으로 전환(숨김) 30초 → 복귀  
4. 숨김 중·복귀 직후 `live` / Supabase 요청이 **활성 탭 수준**인지 기록  
5. (선택) 출고 당시 폴링 스모크 재실행:

```bash
node scripts/archive/ship-p0-visibility-poll-smoke.mjs
```

결과를 이 문서 또는 이슈에 p50/p95·maxInFlight로 남긴다. 기준 참고: [`PERF_BASELINE.md`](./PERF_BASELINE.md) · [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md).

---

## 다음 (P1)

비활성 keep-alive 패널의 **LIVE/enrich pause**, 기간 변경 시 hub epoch 금지 규칙 강화.  
P0 게이트·체크리스트를 통과한 뒤에만 진행.

---

## 변경 이력

| 일시 | 내용 |
|------|------|
| 2026-07-30 | P0 게이트 `verify:hub` · 유닛/수동 스모크 확장 · 본 문서 |
| 2026-07-30 | 스모크 #4로 `normalizeLegacyListModeParam`이 UI에 미연결임을 발견 → `FarmPageContent.syncViewFromUrl`에 배선 |

## 로컬 실행 기록 (2026-07-30)

| 게이트 | 결과 |
|--------|------|
| `npm run verify:hub` | PASS |
| `npm run smoke:hub-url` (localhost) | PASS (#1–#5). 중간: #4 미연결 재현→배선, #5 투어 오버레이→스모크에서 건너뛰기 |
