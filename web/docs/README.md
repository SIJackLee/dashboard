# dashboard/web/docs — 문서 유일 위치

> **앱(제품) 문서는 전부 이 폴더에만 둔다.**  
> `web/` 루트·`scripts/`·`dashboard/docs/` 에 md를 새로 만들지 말 것.  
> 배포: `commit → push → main → Vercel` · 규칙: `SI1/.cursor/rules/single-agent.mdc`  
> 코드 반영: **`git status` / `origin/main`이 문서보다 우선**

---

## 목차 (전부)

### 시작 · 배포 · CI

| 문서 | 내용 |
|------|------|
| [`CLOUD_DEPLOY.md`](./CLOUD_DEPLOY.md) | 배포 정본 |
| [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) | push 전 게이트 |
| [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md) | 출고 스모크 |
| [`GITLAB_CI.md`](./GITLAB_CI.md) | GitLab / GitHub Actions |
| [`SCRIPTS.md`](./SCRIPTS.md) | npm test · verify · 스모크 스크립트 |
| [`mobile-ui-audit.md`](./mobile-ui-audit.md) | 모바일 UI audit |
| [`PERF_BASELINE.md`](./PERF_BASELINE.md) | LIVE/TTFB |
| [`WORKSPACE_NOTES.md`](./WORKSPACE_NOTES.md) | 운영 메모(스냅샷) |
| [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) | 작업 맥락·스키마 참고 |

### 허브 · ARIA · 디자인

| 문서 | 내용 |
|------|------|
| [`farm-hub-url.md`](./farm-hub-url.md) | `/farm` URL·탭·epoch |
| [`aria-protocol.md`](./aria-protocol.md) | ARIA 정본 |
| [`voice-report-poc.md`](./voice-report-poc.md) | PoC·API·한도 |
| [`UI_MOTION.md`](./UI_MOTION.md) | 모션 |
| [`UI_DENSITY.md`](./UI_DENSITY.md) | 밀도·맵 수치 |
| [`UI_ELEVATION.md`](./UI_ELEVATION.md) | elevation |
| [`UI_CHROMA.md`](./UI_CHROMA.md) | 채도 |
| [`UI_FEEDBACK.md`](./UI_FEEDBACK.md) | ops-feedback |
| [`UI_ARIA_PRESENCE.md`](./UI_ARIA_PRESENCE.md) | ARIA presence |
| [`UI_VISUAL_QA.md`](./UI_VISUAL_QA.md) | 시각 QA |

### 운영자 매뉴얼

| 문서 | 내용 |
|------|------|
| [`user-manual/README.md`](./user-manual/README.md) | 목차 |
| [`user-manual/`](./user-manual/) | 00–10 절 + images |

**갭:** 차트·ARIA 전용 매뉴얼 절 없음.

---

## 이 폴더 밖에 두는 것 (문서 아님)

| 경로 | 이유 |
|------|------|
| `web/README.md` | npm/GitHub용 3줄 실행 안내 → 여기로 링크 |
| `web/AGENTS.md` · `CLAUDE.md` | 에디터 도구용 포인터만 |
| `Operation/docs` | 파이프라인·펌웨어 (별 영역) |

```bash
cd dashboard/web
npm test && npm run verify:design && npm run build
```
