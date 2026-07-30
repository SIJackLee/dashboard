# Clean Up — 산출물 맵 (P0–P2)

> 기준일: 2026-07-30 · 저장소: `dashboard` (앱 루트 `web/`)  
> **문서 찾기:** 항상 [`docs/README.md`](./README.md) 먼저.  
> 이 파일은 [Clean Up]이 타 Agent 산출물을 **취합**한 스냅샷이다. 삭제·푸시·migration 적용 없음.

상태 약어: `M` = 수정(tracked) · `U` = untracked · `local` = 커밋 대상 아님(임시)

---

## 1. 문서 (Agent별)

### [허브 셸·라우팅]

| 경로 | 상태 | 비고 |
|------|------|------|
| `docs/farm-hub-url.md` | U | URL·epoch·soft home·keep-alive **정본** |
| `docs/VERCEL_PREVIEW_GATE.md` | U | Git→Vercel Preview 게이트 (Clean Up · 셸 핸드오프) |
| `docs/user-manual/10-메뉴구조도.md` | M | 허브 URL 정합 표 |
| `docs/user-manual/README.md` | M | 진입·갭 안내 |
| `src/lib/farm/farm-view-url.ts` | M | query·탭·soft home helpers |
| `src/lib/farm/farm-hub-keepalive.ts` (+ `.test.ts`) | U | 패널 keep-alive |
| `src/lib/farm/farm-chart-scope.ts` (+ `-url.test.ts`) | M/U | 차트 집계 URL |
| `src/lib/farm/farm-*-smoke|pin.test.ts` | U | 단위 스모크 |
| `scripts/farm-hub-url-manual-smoke.mjs` | U | 브라우저 스모크 · `UI_VERIFY_BASE` |
| `farm-page-content.tsx` | M | **겹침** (셸+디자인+ARIA) — §8 참고 |
| soft home UI | M | `app-header-brand` · `mobile-bottom-nav` · `farm-switcher` |
| `tsconfig.json` | M | `scripts` exclude (Vercel 빌드 게이트) |
| `.cursor/rules/farm-shell-routing.mdc` | (rules) | 셸 Agent 규칙 |

### [디자인 & 애니메이션]

| 경로 | 상태 | 비고 |
|------|------|------|
| `docs/UI_MOTION.md` | M | 정본 |
| `docs/UI_DENSITY.md` | U | |
| `docs/UI_ELEVATION.md` | U | |
| `docs/UI_CHROMA.md` | U | |
| `docs/UI_FEEDBACK.md` | U | |
| `docs/UI_ARIA_PRESENCE.md` | U | presence만 · 프로토콜 비접촉 |
| `docs/UI_VISUAL_QA.md` | U | 수동 QA · H6 금지 명시 |

### [프로토콜] ARIA

| 경로 | 상태 | 비고 |
|------|------|------|
| `docs/aria-protocol.md` | U | **정본** (P1 배너) |
| `docs/voice-report-poc.md` | M | **보조** PoC·UI·API (P1 중복 축소) |

### [Clean Up]

| 경로 | 상태 | 비고 |
|------|------|------|
| `docs/README.md` | U | 전 Agent 문서 진입점 |
| `docs/CLEANUP_ARTIFACT_MAP.md` | U | 본 맵 |

---

## 2. 코드 · 테스트 (요약)

### [프로토콜] ARIA — untracked 핵심

- `src/lib/aria/**` (protocol · pack/unpack · turn-log · test)
- `src/components/farm/farm-aria-view.tsx`, `aria-orb.tsx`
- `src/components/admin/aria-turn-log-panel.tsx`
- `src/app/api/voice-report/aria-logs/`
- `src/app/(dashboard)/admin/ops/aria-log-actions.ts`
- migrations: `20260730130000_aria_turn_log.sql`, `…_retention_7d.sql` (**적용은 승인 후**)

### [디자인] — untracked / 관련

- `src/lib/ui/density.ts`, `ops-feedback.ts`
- `src/components/layout/density-toggle.tsx`
- verify: `scripts/verify-ui-*.mjs`, `verify-motion-css.mjs` (U) · `motion-reduced-audit.mjs` (M)
- 다수 UI 컴포넌트 `M` (토큰 소비 — 목록은 git status 참고)

### [셸] — 관련

- `src/lib/farm/farm-view-url.ts` (M)
- `src/lib/farm/farm-view-url-pin.test.ts` (U)
- `src/lib/farm/farm-chart-scope-url.test.ts` (U)

### 기타 untracked

- `src/lib/data/farm-location-shared.ts`
- `supabase/migrations/20260730120000_farm_location_farm_name.sql` (**적용은 승인 후**)

---

## 3. 스크립트 · 테스팅 (P2 반영)

정본 분류표: [`../scripts/README.md`](../scripts/README.md)

| 경로 | 상태 | 분류 |
|------|------|------|
| `scripts/smoke-aria*.ts(mjs)` | U | **유지** — 로컬 스모크 |
| `scripts/predict-aria-scenarios*.ts` | U | **로컬 전용** (service role) |
| `scripts/print-phrase-variants.ts` | U | **로컬 전용** 유틸 |
| `scripts/daily-report-qa-a.mts` | U | **로컬 전용** QA |
| `scripts/verify-ui-*.mjs` 등 | U | **유지** (`verify:design`) |
| `scripts/archive/*` · one-shot 2건 | **실삭제** | 2026-07-30 · 가드는 `verify:ui-colors` |
| `docs/archive/*` · stub 4건 | **실삭제** | 2026-07-30 · 이력은 git만 |
| `scripts/mobile-audit-output/` | **삭제됨** | gitignore 유지 |
| `web/tmp/` · `dashboard/tmp/` | **삭제됨** | gitignore 보강 |

---

## 4. 예비 삭제 목록 (잔여)

없음 (P2 + archive 실삭제 완료).

---

## 5. P0–P2 + archive 실삭제 이력

| 문제 | 조치 |
|------|------|
| SI1 `README.md`의 `docs/changes/` | → `Operation/RSD/docs/changes/` |
| `docs/` 인덱스 없음 | → `docs/README.md` |
| 테스트 결과 md 산재 | → archive 후 **실삭제** |
| ARIA 문서 역할 모호 | → 정본/보조 (P1) |
| 매뉴얼 vs URL | → 정합 표 + 갭 (P1) |
| tmp · audit PNG/JSON | → 디스크 삭제 + gitignore (P2) |
| one-shot 색 마이그레이션 | → archive 후 **실삭제** |
| 스크립트 산재 | → `scripts/README.md` |

---

## 6. 다음 Clean Up (선택)

- 매뉴얼 차트·ARIA 절 — 작성은 해당 Agent/사용자, Clean Up은 인덱스만  
- ~~미커밋 대량 변경의 커밋 분할 제안~~ → **§7**

---

## 7. 커밋 분할안 (2026-07-30 · 커밋 미실행)

저장소: `dashboard` · branch `main` · dirty ~160+ paths · **push/migration 적용 없음**  
최근 스타일: `feat(web):` / `fix(web):` / `docs:` / `chore:`

### 권장 순서 (의존성)

```
A 디자인 토큰·가드  →  B 허브 셸 URL  →  C 농장 표시명(location)
        ↘__________________↙
              D ARIA 프로토콜
              E Clean Up 문서·잔여 삭제
```

로컬-only로 **커밋에서 빼기 후보:** `scripts/daily-report-qa-a.mts`, `scripts/print-phrase-variants.ts` (원하면 D에 포함 가능).

### A — `feat(web): design tokens H1–H5 and verify:design`

| 포함 | 경로 패턴 |
|------|-----------|
| 문서 | `docs/UI_*.md` (MOTION 수정 + DENSITY/ELEVATION/CHROMA/FEEDBACK/ARIA_PRESENCE/VISUAL_QA 신규) |
| 토큰 | `src/lib/ui/{density,ops-feedback,motion-*,dashboard-page-ui}.ts` · `globals.css` · `layout.tsx`(density) |
| UI 소비 | `components/**` 대량 (channel/elevation/motion) · `density-toggle.tsx` |
| 가드 | `scripts/verify-ui-*.mjs` · `verify-motion-css.mjs` · `motion-reduced-audit.mjs` · `package.json` verify 스크립트 |
| 제외 | `farm-view-url*` · `lib/aria/**` · voice-report · Clean Up README/맵 |

메시지 예: `feat(web): add design system tokens and verify:design guards`

### B — `feat(web): farm hub URL contract and view=aria entry`

| 포함 | 경로 |
|------|------|
| 정본 | `docs/farm-hub-url.md` · `user-manual/10-메뉴구조도.md`(정합) · `user-manual/README.md` |
| 코드 | `src/lib/farm/farm-view-url.ts` · `farm-view-url-pin.test.ts` · `farm-chart-scope*.ts` · `farm-hub-keepalive*` · `farm-hub-url-smoke.test.ts` |
| 셸 연동 | `farm-page-content.tsx` (**겹침:** 디자인/ARIA 마운트 포함 → A 이후·D 전에 이 커밋에 묶거나, 스테이징 주의) |
| 내비 | `nav-utils.ts` · `mobile-bottom-nav` 등 view 전환 관련만 가능하면 분리 |

메시지 예: `feat(web): document and harden farm hub URL and tab sync`

### C — `feat(web): farm_location display name`

| 포함 | 경로 |
|------|------|
| migration | `supabase/migrations/20260730120000_farm_location_farm_name.sql` (**DB 적용은 별도 승인**) |
| 코드 | `farm-location*.ts` · `farm-location-shared.ts` · `farm-location-client.ts` · settings UI (`admin-farm-location*`, `farm-address*`, `farm-location-bulk*`) · `farm-summaries.ts` 관련 |
| 참고 | ARIA 호칭이 이 필드에 의존하면 D보다 먼저 |

메시지 예: `feat(web): add farm_name to farm_location for display labels`

### D — `feat(web): ARIA protocol v1 and turn log`

| 포함 | 경로 |
|------|------|
| 문서 | `docs/aria-protocol.md` · `docs/voice-report-poc.md` |
| 코드 | `src/lib/aria/**` · `farm-aria-view.tsx` · `aria-orb.tsx` · `voice-report-fab.tsx` · ask/aria-logs API · `aria-turn-log-panel` · `aria-log-actions` |
| facts | `voice-report/build-farm-facts.ts` · `types.ts` |
| migrations | `20260730130000_aria_turn_log.sql` · `…retention_7d` · `…feedback` (**적용 별도 승인**) |
| env | `web/.env.example` ARIA_* 줄 |
| 스크립트 | `smoke-aria*.ts(mjs)` · `predict-aria-scenarios*.ts` (로컬 전용 포함 여부 선택) |

메시지 예: `feat(web): add ARIA judge protocol, unpack path, and turn log`

### E — `chore(web): clean up docs index and remove stale test artifacts`

| 포함 | 경로 |
|------|------|
| 인덱스 | `docs/README.md` · `docs/CLEANUP_ARTIFACT_MAP.md` · `scripts/README.md` · `web/README.md`(문서 진입점 줄) |
| 삭제 | `docs/alarm-settings-test-*.md` · `topbar-bell-test-results.md` · `ui-display-cycle-test-results.md` (tracked 삭제) |
| ignore | `dashboard/.gitignore` · `web/.gitignore` tmp/audit |

메시지 예: `chore(web): add docs/scripts indexes and drop stale test result docs`

SI1 루트 `README.md`(`docs/changes` 정정)는 **dashboard repo 밖** — 별도 커밋/보관.

### 겹침 파일 (스테이징 주의)

| 파일 | 주 소유 커밋 | 비고 |
|------|--------------|------|
| `farm-page-content.tsx` | B (셸) | ARIA 탭 마운트·모션 소비 포함 → A 다음 B에 통째 권장 |
| `package.json` | A | verify 스크립트만이면 A. ARIA npm 스크립트 추가 시 D에 한 줄 더 |
| `globals.css` | A | |
| `eslint.config.mjs` | A 또는 E | 변경 내용 보고 배정 |

### 실행 전 체크

1. 사용자 **커밋 승인** (이 안은 제안만)  
2. migration **적용**은 커밋과 분리 — 파일만 D/C에 넣고 운영 적용은 별도  
3. `npm run verify:design` (A 후) · `npx tsx scripts/smoke-aria.ts` (D 후)  
4. push는 별도 승인  
5. **갱신 (셸 핸드오프):** main 직푸시 비권장 → **§8 `feature/farm-hub-url` 우선** · Preview 게이트 [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md)

---

## 8. 셸 핸드오프 — `feature/farm-hub-url` 분리 초안

출처: 허브 셸·라우팅 Agent · Clean Up 취합 (2026-07-30)  
**의미 변경 금지:** `view` / `trendPeriod` / drill / `chart*` / epoch / keep-alive TTL  
**실행 금지(승인 전):** push · merge · 삭제 · migration

### 8.1 브랜치에 **넣을** 파일 (셸만)

| 구분 | 경로 |
|------|------|
| 계약 | `docs/farm-hub-url.md` |
| 게이트 문서 | `docs/VERCEL_PREVIEW_GATE.md` (Clean Up) · 선택: `docs/README.md` 허브 링크 줄만 |
| keep-alive | `src/lib/farm/farm-hub-keepalive.ts` · `farm-hub-keepalive.test.ts` |
| URL | `src/lib/farm/farm-view-url.ts` · `farm-chart-scope.ts` |
| 테스트 | `farm-hub-url-smoke.test.ts` · `farm-view-url-pin.test.ts` · `farm-chart-scope-url.test.ts` |
| 브라우저 스모크 | `scripts/farm-hub-url-manual-smoke.mjs` |
| 셸 UI | `src/components/layout/app-header-brand.tsx` · `mobile-bottom-nav.tsx` · `farm-switcher.tsx` |
| 빌드 게이트 | `tsconfig.json` (`scripts` exclude) |
| 매뉴얼(정합) | `docs/user-manual/10-메뉴구조도.md` · `user-manual/README.md` (URL 표만이면 포함) |
| 규칙 | SI1 `.cursor/rules/farm-shell-routing.mdc` — **dashboard repo 밖**이면 이 브랜치에 안 넣음 |

### 8.2 **빼기** (타 Agent — 이 브랜치에 넣지 말 것)

| 경로 패턴 | Agent |
|-----------|--------|
| `docs/UI_*.md` · `src/lib/ui/**` · `globals.css` · `verify-ui-*` · 대부분 `components/**` 토큰 소비 | 디자인 |
| `env-comfort-score.ts` · `grid-metric-label.tsx` · `severity-score.ts` · `trend-chart-series.ts` · `unified-barn-trend-series.ts` | 디자인/차트 (셸 URL 아님) |
| `src/lib/aria/**` · `farm-aria-view` · `aria-orb` · voice-report · aria migrations | 프로토콜 |
| `farm-location*` · `farm_name` migration | location (C) |
| Clean Up 전용만: `CLEANUP_ARTIFACT_MAP.md` 전체 · `scripts/README` ARIA 절 — 셸 브랜치에 **필수 아님** (게이트 문서는 8.1에 포함) |

### 8.3 겹침 — `farm-page-content.tsx`

- soft home · keep-alive · URL sync = **셸**  
- 모션/ARIA 탭 마운트가 같은 파일에 있으면:  
  - **권장:** 셸 브랜치에 **통째 포함**하되, Preview 스모크는 URL/탭만 판정  
  - 또는 셸 Agent가 hunk 단위 스테이징 (난이도 높음)  
- 디자인「기간 줌 리셋」·프로토콜「soft home 후 오브」는 **후속 브랜치**

### 8.4 예비 삭제 목록 (목록만 · 삭제 안 함)

| 후보 | 이유 | 권장 |
|------|------|------|
| (신규 없음) 셸 산출물 | 유지·문서화 대상 | **삭제 금지** |
| tracked 삭제 잔여: 옛 테스트 md 4건 | 이미 실삭제됨 · 워킹트리 `D`면 E 커밋에서 정리 | 셸 브랜치와 **분리** |
| `predict-aria-*.ts` | 로컬 전용 · tsconfig exclude로 빌드 안전 | 삭제 불필요 · **커밋 여부만** 선택 |

### 8.5 배포 검증 (요약)

상세: [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md)

1. `feature/farm-hub-url` 커밋 (**승인 후**)  
2. push (**승인 후**) → Preview URL  
3. `UI_VERIFY_BASE=https://<preview>.vercel.app node scripts/farm-hub-url-manual-smoke.mjs`  
4. 통과 시 MR → Production 동일 스모크  

### 8.6 다음 승인 필요

| 항목 | 상태 |
|------|------|
| `feature/farm-hub-url` 브랜치 생성·커밋 | **승인 대기** |
| push → Preview | **승인 대기** |
| Preview 스모크 실행 | Preview URL 필요 |
| merge → main / Production | **승인 대기** |
| 예비 삭제 실행 | 해당 없음(셸) / 옛 테스트 `D`는 E에서 |