# Clean Up — 산출물 맵

> 갱신: 2026-07-30 · **단일 에이전트** 모드 · 저장소 `dashboard` (`web/`)  
> 찾기: 항상 [`docs/README.md`](./README.md).  
> 이 파일은 스냅샷이다. **실제 기준은 `git status`**.

---

## 운영 모드

| 항목 | 상태 |
|------|------|
| 멀티 Agent 핸드오프 | **중단** — `SI1/.cursor/rules/single-agent.mdc` only (`alwaysApply`) |
| legacy rules | design / protocol / shell / cleanup mdc → `alwaysApply: false` (참고용) |
| 배포 실행 | 단일 에이전트 · 게이트 [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) |
| Production | `main` @ ARIA stage LIVE metrics 포함 (2026-07-30) |

---

## P0 triage (이번 정리)

### 커밋 대상 (의도적 유지)

| 구분 | 경로 |
|------|------|
| 디자인 정본 | `docs/UI_{CHROMA,DENSITY,ELEVATION,FEEDBACK,VISUAL_QA,ARIA_PRESENCE}.md` |
| 게이트·맵 | `docs/VERCEL_PREVIEW_GATE.md`, 본 파일, `docs/README.md` |
| 가드 | `scripts/verify-ui-density.mjs`(기배포), `verify-motion-css.mjs`, `verify-ui-colors.mjs`, `verify-ui-elevation.mjs` |
| 로컬 스모크 | `scripts/smoke-aria-*.mjs`, `predict-aria-scenarios*.ts`, `print-phrase-variants.ts`, `daily-report-qa-a.mts` |
| 정리 | 일회성 test-results md **삭제**, eslint / gitignore / motion-reduced-audit |

### npm

- `verify:design` = motion + **ui-density** (맵 가드) — Production 팔레트와 충돌하는 colors/elevation은 `*:strict`로만
- 로컬 스모크는 package.json 미등록 (scripts/README 참고)

### 보안

- `web/.env.example` — 실JWT 제거, placeholder만

---

## 겹침 주의 파일

| 파일 | 이유 |
|------|------|
| `farm-page-content.tsx` | 허브 탭 + 디자인 + ARIA 마운트 |
| `globals.css` / `dashboard-page-ui.ts` | 토큰·ARIA 셸·밀도 |

단일 에이전트가 한 PR에서 끝까지 처리한다.

---

## 예비 삭제 목록 (실행 안 함)

| 후보 | 이유 | 승인 |
|------|------|------|
| `dashboard-aria-ship/` · `dashboard-build-check/` | 병렬 worktree 혼선 | 사용자 |
| legacy Agent mdc 파일 실삭제 | 현재는 alwaysApply만 off | 사용자 |

---

## 교훈

1. 로컬 dirty build PASS ≠ Vercel clean build PASS  
2. stub·반쪽 import → Production “작동안 함”  
3. 산출물 맵이 git보다 낡으면 오판 — **status 우선**
