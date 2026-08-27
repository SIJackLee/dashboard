# scripts/ — 스크립트 분류

> 앱 문서 진입점: [`README.md`](./README.md) · 배포: [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md)

실행 위치: 항상 `dashboard/web/` (`npm run …` 또는 `npx tsx scripts/…`).

분류: **A** CI/npm 게이트 · **B** assert·공유 · **C** 로컬 스모크·도구 · **D** archive(일회성)

---

## A — CI · package.json 게이트

| npm / 파일 | 용도 |
|------------|------|
| `npm test` / `test:unit` → `run-unit-tests.mjs` | `src/**/*.test.ts` · `supabase/functions/**/*.test.ts` |
| `verify:hub` → `verify-hub.mjs` | 허브 URL·keep-alive 유닛 ([`HUB_STABILITY_P0.md`](./HUB_STABILITY_P0.md)) |
| `verify:design` | `verify-motion-classes` + `verify-ui-density` |
| `verify:motion-css` / `verify:motion-tokens` / `verify:motion-classes` | 모션 |
| `verify:ui-colors` / `verify:ui-density` / `verify:ui-elevation` | UI 토큰·밀도 (colors/elevation은 Production 팔레트와 충돌 가능) |
| `audit:ship-checklist` → `ship-checklist-audit.mjs` | 출고 체크리스트 |
| `audit:operator-apply` → `operator-apply-audit.mjs` | 적용 감사 |
| `audit:farm-command` → `farm-command-audit.mjs` | 명령 파이프라인 |
| `audit:health-drilldown` → `health-drilldown-audit.mjs` | 헬스 드릴다운 |
| `audit:mobile-*` / `audit:motion-reduced` / `audit:touch-mobile-layout` | 모바일·모션 감사 |
| `measure:live` → `measure-live-read.ts` | LIVE 읽기 |
| `measure:hub-ttfb` → `measure-hub-ttfb.mjs` | 허브 TTFB |
| `audit-shared.mjs` | 감사 공통 (직접 실행 아님) |

GitLab `web:test` / `web:verify-design`, GitHub `.github/workflows/web-verify.yml`이 A 일부를 돌린다.

---

## B — assert (로컬 · 선택적으로 `npm test`에 흡수 가능)

| 파일 | 용도 |
|------|------|
| `assert-channel-fan-band.ts` | 채널 팬 밴드 |
| `assert-command-pipeline-id-ttl.ts` | 명령 파이프라인 ID/TTL |
| `assert-scoped-panel-hydrate.ts` | 스코프 패널 hydrate |

---

## C — 로컬 스모크 · 도구 (CI 비포함)

| 파일 | 용도 |
|------|------|
| `farm-hub-url-manual-smoke.mjs` (`npm run smoke:hub-url`) | 허브 URL·탭·soft home — [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) · [`HUB_STABILITY_P0.md`](./HUB_STABILITY_P0.md) |
| `verify-channel-bulk-commands.mjs` | 채널 일괄 명령 |
| `smoke-aria.ts` | 라우팅·DEPTH·unpack (네트워크 불필요) |
| `smoke-aria-ui-ask.mjs` | UI/ask (서버·환경 필요) |
| `smoke-aria-logs-browse.mjs` | 턴 로그 브라우즈 |
| `smoke-aria-stage.mjs` / `smoke-aria-feedback.mjs` / `smoke-aria-review-loop.mjs` | 스테이지·피드백·리뷰 |
| `predict-aria-scenarios.ts` / `predict-aria-scenarios-alarmed.ts` | facts → 예상 답변 (service role) |
| `print-phrase-variants.ts` | 문구 변주 |
| `set-test-passwords.mjs` / `test-accounts.mjs` | 로컬 테스트 계정 (비밀값 커밋 금지) |

---

## D — archive (일회성 · 재실행 시만)

경로: `scripts/archive/` — 설명은 [`scripts/archive/README.md`](../scripts/archive/README.md).

| 파일 | 당시 용도 |
|------|-----------|
| `ship-p0-gate-smoke.mjs` | P0 hydration·테마·적용·LIVE |
| `ship-p0-visibility-poll-smoke.mjs` | 탭 숨김·대량 LIVE 폴링 |
| `manual-scenarios-13562-smoke.mjs` | 수동 시나리오 자동화 |
| `diag-tab-hidden-poll.mjs` | 탭 숨김 폴링 진단 |
| `detailed-reverify.mjs` | 상세 재검증 |
| `graph-mode-card-collapse-smoke.mjs` | 그래프 모드 카드 접힘 |
| `daily-report-qa-a.mts` | 일보 QA |
| `daily-report-payload-smoke.mts` | 일보 payload 스모크 |

과거 PASS 기록은 [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md)에 남김. 경로만 `scripts/archive/…`로 갱신.

---

## gitignore · 커밋 금지

| 경로 | 비고 |
|------|------|
| `mobile-audit-output/` | audit·스모크 산출 |
| `tmp/` · `../tmp/` | 임시 |
| `post-push-ui-verify.log` | 로컬 로그 |
