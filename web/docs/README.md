# dashboard/web 문서 진입점

> 문서를 찾을 때 **이 파일부터** 연다.  
> 경로: `dashboard/web/docs/README.md`  
> **운영 모드: 단일 에이전트** (`SI1/.cursor/rules/single-agent.mdc`)  
> 산출물 스냅샷: [`CLEANUP_ARTIFACT_MAP.md`](./CLEANUP_ARTIFACT_MAP.md) · 실제는 `git status`

## 주제 → 정본 문서

| 주제 | 먼저 읽을 정본 | 보조 |
|------|----------------|------|
| **허브 URL·탭** | [`farm-hub-url.md`](./farm-hub-url.md) | keep-alive · soft home · [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) |
| **디자인·모션** | [`UI_MOTION.md`](./UI_MOTION.md) | [`UI_DENSITY`](./UI_DENSITY.md) · [`UI_ELEVATION`](./UI_ELEVATION.md) · [`UI_CHROMA`](./UI_CHROMA.md) · [`UI_FEEDBACK`](./UI_FEEDBACK.md) · [`UI_ARIA_PRESENCE`](./UI_ARIA_PRESENCE.md) · [`UI_VISUAL_QA`](./UI_VISUAL_QA.md) |
| **ARIA 프로토콜** | [`aria-protocol.md`](./aria-protocol.md) **정본** | [`voice-report-poc.md`](./voice-report-poc.md) **보조**(PoC·UI·API·한도) |
| **정리·배포 게이트** | [`CLEANUP_ARTIFACT_MAP.md`](./CLEANUP_ARTIFACT_MAP.md) · [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) | [`../scripts/README.md`](../scripts/README.md) |

검증: `npm run verify:design` · Preview/Production [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md)

---

## 문서 목록 (전부)

### 허브 · 출고 · 성능

| 문서 | 용도 |
|------|------|
| [`farm-hub-url.md`](./farm-hub-url.md) | `/farm` query · view · epoch · soft home · keep-alive |
| [`VERCEL_PREVIEW_GATE.md`](./VERCEL_PREVIEW_GATE.md) | Git→Vercel Preview 스모크 절차 |
| [`SHIP_CHECKLIST.md`](./SHIP_CHECKLIST.md) | 출고 스모크 · 역할별 경로 |
| [`PERF_BASELINE.md`](./PERF_BASELINE.md) | LIVE read · TTFB 기준 |

### 디자인 시스템 (H1–H5 동결 · 유지보수)

| 문서 | 용도 |
|------|------|
| [`UI_MOTION.md`](./UI_MOTION.md) | L1/L2 모션 · 예외 · verify |
| [`UI_DENSITY.md`](./UI_DENSITY.md) | comfortable / compact |
| [`UI_ELEVATION.md`](./UI_ELEVATION.md) | 면 elevation 0–3 |
| [`UI_CHROMA.md`](./UI_CHROMA.md) | 채널·상태 채도 |
| [`UI_FEEDBACK.md`](./UI_FEEDBACK.md) | ops-feedback |
| [`UI_ARIA_PRESENCE.md`](./UI_ARIA_PRESENCE.md) | ARIA 탭 presence 톤 (프로토콜 비접촉) |
| [`UI_VISUAL_QA.md`](./UI_VISUAL_QA.md) | 수동 QA · 고급감 갭 (H6 승인 전) |

### ARIA

| 문서 | 역할 |
|------|------|
| [`aria-protocol.md`](./aria-protocol.md) | **정본** — JUDGE / SAY / REC / DEPTH / 금지 |
| [`voice-report-poc.md`](./voice-report-poc.md) | **보조** — PoC UI·API·한도·롤백·플래그 (규칙 중복 금지) |

### 사용자 매뉴얼

| 문서 | 용도 |
|------|------|
| [`user-manual/README.md`](./user-manual/README.md) | 운영자용 매뉴얼 목차 |
| [`user-manual/10-메뉴구조도.md`](./user-manual/10-메뉴구조도.md) | IA + 허브 URL 정합 요약 |

매뉴얼 갭: **차트**·**ARIA** 전용 절 없음 (IA에는 탭 있음).

> 과거 테스트 결과 md · 일회성 마이그레이션 스크립트는 **실삭제됨** (2026-07-30). 이력은 git에만 남음.

---

## 워크스페이스 밖 / 인접 문서

| 경로 | 용도 |
|------|------|
| `dashboard/web/README.md` | 앱 실행 · env · 배포 |
| `dashboard/docs/PROJECT_CONTEXT.md` | 대시보드 작업 맥락 |
| `dashboard/docs/GITLAB_CI.md` | CI |
| `Operation/docs/` · `Operation/RSD/docs/` | 파이프라인 · wire 스펙 · 변경 이력 (`changes/`) |
| `SI1/README.md` | 워크스페이스 루트 안내 |
| `SI1/.cursor/rules/*.mdc` | Agent 경계 규칙 |

변경 이력(마이그레이션 메모) 정본은 **`Operation/RSD/docs/changes/`** (루트 `docs/changes/` 아님).

## 스크립트

| 경로 | 용도 |
|------|------|
| [`../scripts/README.md`](../scripts/README.md) | 스모크·verify·로컬 분류 (헤매지 않기) |
