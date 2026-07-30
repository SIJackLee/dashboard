# scripts/ — 스크립트 분류

> 앱 문서 진입점: [`README.md`](./README.md) · 배포: [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md)

실행 위치: 항상 `dashboard/web/` (`npm run …` 또는 `npx tsx scripts/…`).

---

## CI · package.json 게이트

| 스크립트 / npm | 용도 |
|----------------|------|
| `npm test` / `test:unit` | `src` 아래 `*.test.ts` (protocol · hub URL · chart) — `run-unit-tests.mjs` |
| `verify:design` | motion + ui-density (맵 수치 가드) |
| `verify:motion-css` / `verify:ui-*:strict` | 선택(엄격) — colors/elevation은 Production 팔레트와 충돌할 수 있음 |
| `audit:*` | 출고·모바일·명령 감사 (Playwright 등) |
| `measure:live` / `measure:hub-ttfb` | 성능 기준 |

---

## 로컬 스모크 (package.json 미등록)

| 파일 | 용도 |
|------|------|
| `farm-hub-url-manual-smoke.mjs` | 허브 URL·탭·soft home — `UI_VERIFY_BASE=…` · [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) |
| `smoke-aria.ts` | 라우팅·DEPTH·unpack (네트워크 불필요) |
| `smoke-aria-ui-ask.mjs` | UI/ask (서버·환경 필요) |
| `smoke-aria-logs-browse.mjs` | 턴 로그 브라우즈 |
| `smoke-aria-stage.mjs` / `smoke-aria-feedback.mjs` / `smoke-aria-review-loop.mjs` | 스테이지·피드백·리뷰 루프 |

---

## 로컬 전용 (커밋됨 · CI 비포함)

| 파일 | 용도 |
|------|------|
| `predict-aria-scenarios.ts` / `*-alarmed.ts` | facts → 예상 답변 (service role · tsconfig scripts exclude) |
| `print-phrase-variants.ts` | 문구 변주 |
| `daily-report-qa-a.mts` | 일보 QA |

---

## 삭제됨 (git 이력만)

- channel migrate/fix 일회성 스크립트 · 과거 test-results md · `scripts/archive/`

---

## gitignore · 커밋 금지

| 경로 | 비고 |
|------|------|
| `mobile-audit-output/` | audit 산출 |
| `tmp/` · `../tmp/` | 임시 |
