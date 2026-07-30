# scripts/ — 스크립트 분류

> Agent·개발자: **이 파일부터** 본다. 앱 문서 진입점은 [`../docs/README.md`](../docs/README.md).

실행 위치: 항상 `dashboard/web/` (`npm run …` 또는 `npx tsx scripts/…`).

---

## 유지 (CI · package.json · 가드)

| 스크립트 / npm | 용도 | 비고 |
|----------------|------|------|
| `npm test` / `test:unit` | `src/**/*.test.ts` (protocol · hub URL · chart) | **P1 게이트** · `scripts/run-unit-tests.mjs` |
| `verify:design` (motion + ui-density) | 모션·맵 수치 가드 | 기본 게이트 |
| `verify:motion-css` / `verify:ui-*:strict` | 차트 CSS·색·elevation | 선택(엄격) |
| `audit:ship-checklist` 등 `audit:*` | 출고·모바일·명령 감사 | |
| `measure:live` / `measure:hub-ttfb` | 성능 기준 | |

---

## 유지 · 로컬 스모크 (package.json 미등록)

| 파일 | 용도 | 비고 |
|------|------|------|
| `farm-hub-url-manual-smoke.mjs` | 허브 URL·탭·soft home (브라우저) | **셸** · Preview: `UI_VERIFY_BASE=https://…` — [`../docs/VERCEL_PREVIEW_GATE.md`](../docs/VERCEL_PREVIEW_GATE.md) |
| `smoke-aria.ts` | 라우팅·DEPTH·unpack (네트워크 불필요) | **ARIA 기본 스모크** |
| `smoke-aria-ui-ask.mjs` | UI/ask 경로 스모크 | 서버·환경 필요 |
| `smoke-aria-logs-browse.mjs` | 턴 로그 브라우즈 | 관리자·환경 필요 |

---

## 로컬 전용 (커밋 가능 · CI 비포함)

| 파일 | 용도 | 비고 |
|------|------|------|
| `predict-aria-scenarios.ts` | live facts → 예상 답변 | service role · **tsconfig scripts exclude** (Vercel 빌드) |
| `predict-aria-scenarios-alarmed.ts` | 알람 시나리오 예측 | 동일 |
| `print-phrase-variants.ts` | 문구 변주 인쇄 | 유틸 |
| `daily-report-qa-a.mts` | 일보 QA | 로컬 |

---

## 삭제됨 (재실행 불가 · git 이력만)

- 일회성: `fix-channel-100.mjs`, `migrate-channel-colors.mjs` (channel 토큰 이관 완료)
- 과거 테스트 md · `scripts/archive/` · `docs/archive/` (2026-07-30 실삭제)
- 회귀 가드: `npm run verify:design` / `verify:ui-colors`

---

## 로컬 산출물 (gitignore · 커밋 금지)

| 경로 | 비고 |
|------|------|
| `mobile-audit-output/` | audit PNG/JSON — 정리됨 · gitignore |
| `../tmp/` · `../../tmp/` | 임시 — 정리됨 · gitignore |
