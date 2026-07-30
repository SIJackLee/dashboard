# dashboard/web 문서 (단일 루트)

> **모든 앱 문서는 이 폴더에 둔다:** `dashboard/web/docs/`  
> 운영: 단일 에이전트 · 배포: `commit → push → main → Vercel`  
> 규칙: `SI1/.cursor/rules/single-agent.mdc`  
> 코드 반영 여부: **문서보다 `git status` / `origin/main` 우선**

---

## 인덱스

| 하고 싶은 일 | 문서 |
|--------------|------|
| 로컬 실행 · env | [`../README.md`](../README.md) (요약) · [`.env.example`](../.env.example) |
| Production 배포 | [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) |
| push 전 게이트 | [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) |
| `/farm` URL·탭 | [`farm-hub-url.md`](./farm-hub-url.md) |
| ARIA 판단 규칙 | [`aria-protocol.md`](./aria-protocol.md) |
| 디자인 토큰·모션 | [`UI_MOTION.md`](./UI_MOTION.md) |
| 스크립트·테스트 | [`SCRIPTS.md`](./SCRIPTS.md) |
| 모바일 UI audit | [`mobile-ui-audit.md`](./mobile-ui-audit.md) |
| CI | [`GITLAB_CI.md`](./GITLAB_CI.md) · `../.github/workflows/web-verify.yml` (repo 루트 기준 `dashboard/.github`) |
| 작업 맥락·스키마 | [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) |
| 운영자 매뉴얼 | [`user-manual/README.md`](./user-manual/README.md) |
| 운영 메모 | [`WORKSPACE_NOTES.md`](./WORKSPACE_NOTES.md) |

```bash
cd dashboard/web
npm test && npm run verify:design && npm run build
```

---

## 폴더 안 구성

```
docs/
  README.md              ← 여기 (인덱스)
  CLOUD_DEPLOY.md        ← 배포 정본
  VERCEL_PREVIEW_GATE.md
  farm-hub-url.md
  aria-protocol.md
  voice-report-poc.md
  UI_*.md
  SCRIPTS.md
  mobile-ui-audit.md
  GITLAB_CI.md
  PROJECT_CONTEXT.md
  SHIP_CHECKLIST.md
  PERF_BASELINE.md
  WORKSPACE_NOTES.md
  CLEANUP_ARTIFACT_MAP.md  ← stub → WORKSPACE_NOTES
  user-manual/
```

### 루트에 남기는 것 (도구/관례)

| 경로 | 이유 |
|------|------|
| `web/README.md` | npm/GitHub 기본 README — **짧은 포인터 + 실행만** |
| `web/AGENTS.md` · `web/CLAUDE.md` | Cursor/Claude 도구 stub (Next 주의) |
| `web/scripts/*.mjs` | 코드 · 문서는 `docs/SCRIPTS.md` |

---

## 주제 → 정본

| 주제 | 정본 | 보조 |
|------|------|------|
| 배포 | [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) | [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) · [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md) |
| 허브 URL | [`farm-hub-url.md`](./farm-hub-url.md) | |
| ARIA | [`aria-protocol.md`](./aria-protocol.md) | [`voice-report-poc.md`](./voice-report-poc.md) |
| 디자인 | [`UI_MOTION.md`](./UI_MOTION.md) | Density · Elevation · Chroma · Feedback · ARIA Presence · Visual QA |
| 스크립트 | [`SCRIPTS.md`](./SCRIPTS.md) | [`mobile-ui-audit.md`](./mobile-ui-audit.md) |
| 성능 | [`PERF_BASELINE.md`](./PERF_BASELINE.md) | |
| 맥락 | [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) | 구 테이블명 혼재 가능 → `src/lib/data` 교차 |

**매뉴얼 갭:** 차트·ARIA 전용 사용설명서 절 없음 (`user-manual/`).

---

## 인접 (이 폴더 밖)

| 경로 | 용도 |
|------|------|
| `SI1/README.md` | 워크스페이스 |
| `Operation/RSD/docs/` | 파이프라인·wire · **변경 이력** `changes/` |
| `dashboard/.gitlab-ci.yml` · `dashboard/.github/` | CI 정의 파일 |
