# dashboard/web 문서 진입점

> **이 파일부터** 연다. (`dashboard/web/docs/README.md`)  
> 운영: **단일 에이전트** · 배포: **`commit → push → main → Vercel 자동배포`**  
> ([`../CLOUD_DEPLOY.md`](../CLOUD_DEPLOY.md) · [`SI1/.cursor/rules/single-agent.mdc`](../../../.cursor/rules/single-agent.mdc))

실제 코드 반영 여부는 **문서보다 `git status` / `main`** 이 우선이다.

---

## 빠른 링크

| 하고 싶은 일 | 문서 |
|--------------|------|
| 로컬 실행 · env | [`../README.md`](../README.md) · [`../.env.example`](../.env.example) |
| Production 배포 | [`../CLOUD_DEPLOY.md`](../CLOUD_DEPLOY.md) |
| push 전 게이트 | [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) |
| `/farm` URL·탭 | [`farm-hub-url.md`](./farm-hub-url.md) |
| ARIA 판단 규칙 | [`aria-protocol.md`](./aria-protocol.md) |
| 디자인 토큰·모션 | [`UI_MOTION.md`](./UI_MOTION.md) |
| 단위·스모크 스크립트 | [`../scripts/README.md`](../scripts/README.md) |
| 운영자 매뉴얼 | [`user-manual/README.md`](./user-manual/README.md) |
| CI | [`../../docs/GITLAB_CI.md`](../../docs/GITLAB_CI.md) · `.github/workflows/web-verify.yml` |

검증 명령 (로컬/CI):

```bash
cd dashboard/web
npm test
npm run verify:design
npm run build
```

---

## 주제 → 정본

| 주제 | 정본 | 보조 |
|------|------|------|
| **배포** | [`../CLOUD_DEPLOY.md`](../CLOUD_DEPLOY.md) | [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) · [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md) |
| **허브 URL·탭** | [`farm-hub-url.md`](./farm-hub-url.md) | keep-alive · soft home (본문 내) |
| **ARIA 프로토콜** | [`aria-protocol.md`](./aria-protocol.md) | [`voice-report-poc.md`](./voice-report-poc.md) (PoC·API·한도) |
| **디자인** | [`UI_MOTION.md`](./UI_MOTION.md) | Density · Elevation · Chroma · Feedback · ARIA Presence · Visual QA |
| **성능** | [`PERF_BASELINE.md`](./PERF_BASELINE.md) | `npm run measure:*` |
| **작업 맥락·스키마** | [`../../docs/PROJECT_CONTEXT.md`](../../docs/PROJECT_CONTEXT.md) | Supabase · 권한 (주의: 구 테이블명 혼재 가능) |
| **운영 메모** | [`WORKSPACE_NOTES.md`](./WORKSPACE_NOTES.md) | 교훈·예비 삭제 · **git status가 진실** |

---

## 문서 목록

### 배포 · 허브 · 성능

| 문서 | 용도 |
|------|------|
| [`../CLOUD_DEPLOY.md`](../CLOUD_DEPLOY.md) | 배포 기준 (Git→Vercel · CLI 특수) |
| [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) | push 전 완전 반영 체크 |
| [`farm-hub-url.md`](./farm-hub-url.md) | `/farm` query · view · epoch · soft home |
| [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md) | 출고 스모크 |
| [`PERF_BASELINE.md`](./PERF_BASELINE.md) | LIVE read · TTFB |
| [`WORKSPACE_NOTES.md`](./WORKSPACE_NOTES.md) | 정리 메모 · 교훈 (스냅샷) |

### 디자인 (H1–H5 동결 · 유지보수)

| 문서 | 용도 |
|------|------|
| [`UI_MOTION.md`](./UI_MOTION.md) | L1/L2 모션 · 예외 · verify |
| [`UI_DENSITY.md`](./UI_DENSITY.md) | comfortable / compact · 맵 수치 |
| [`UI_ELEVATION.md`](./UI_ELEVATION.md) | 면 elevation 0–3 |
| [`UI_CHROMA.md`](./UI_CHROMA.md) | 채널·상태 채도 |
| [`UI_FEEDBACK.md`](./UI_FEEDBACK.md) | ops-feedback |
| [`UI_ARIA_PRESENCE.md`](./UI_ARIA_PRESENCE.md) | ARIA 탭 presence (프로토콜 비접촉) |
| [`UI_VISUAL_QA.md`](./UI_VISUAL_QA.md) | 수동 QA · H6 승인 전 |

### ARIA

| 문서 | 역할 |
|------|------|
| [`aria-protocol.md`](./aria-protocol.md) | JUDGE / SAY / REC / DEPTH / 금지 |
| [`voice-report-poc.md`](./voice-report-poc.md) | UI·API·한도·플래그 · 정본과 규칙 중복 금지 |

### 사용자 매뉴얼

| 문서 | 용도 |
|------|------|
| [`user-manual/README.md`](./user-manual/README.md) | 운영자 목차 |
| [`user-manual/10-메뉴구조도.md`](./user-manual/10-메뉴구조도.md) | IA + URL 정합 |

**갭 (미작성):** 차트 탭 · ARIA 탭 전용 사용설명서 절.

---

## 인접 (이 repo 밖 / 옆)

| 경로 | 용도 |
|------|------|
| `SI1/README.md` | 워크스페이스 루트 |
| `SI1/.cursor/rules/single-agent.mdc` | 에이전트 운영 규칙 |
| `Operation/` · `Operation/RSD/docs/` | 파이프라인 · wire · **변경 이력 정본** `changes/` |
| `dashboard/docs/GITLAB_CI.md` | GitLab CI (+ GitHub Actions 안내) |

---

## 스크립트

| 경로 | 용도 |
|------|------|
| [`../scripts/README.md`](../scripts/README.md) | `npm test` · verify · 로컬 스모크 분류 |
