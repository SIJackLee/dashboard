# UI Feedback (H4 — 운영 피드백)

명령 **적용(전송) 완료**를 성공으로 안내합니다. 값은 적용 직후 명령값으로 표시하며, LIVE/ACK 일치는 백그라운드 신뢰 모델입니다.

관련: [UI_MOTION.md](./UI_MOTION.md) · [UI_CHROMA.md](./UI_CHROMA.md) · [UI_ELEVATION.md](./UI_ELEVATION.md)  
코드: `src/lib/ui/ops-feedback.ts` · `command-pipeline-overlay.tsx` · `inline-status-toast.tsx`

## 톤 (`opsFeedbackTone`)

| tone | 용도 | 색 |
|------|------|-----|
| `ok` | 적용 성공 | `--status-ok` |
| `warn` | 부분 실패 · 주의 | `--status-warn` |
| `error` | 실패 | `--status-danger` |
| `info` | 안내 | border + foreground |
| `loading` | 적용 중 | muted + spin |

셸: `opsFeedbackShell` (= elevation float급 `shadow-lg`).

## 명령 파이프라인 모션

| phase | 모션 |
|-------|------|
| loading | 오버레이 fade |
| success / error | `.ui-motion-feedback-icon` soft scale-in (amplitude 토큰) |

`useSettingsApplyOverlay`가 전송 성공을 곧바로 success로 표시한다.

## 컴포넌트

| UI | 레이어 |
|----|--------|
| `CommandPipelineOverlay` | FEEDBACK_Z.overlay |
| `BulkLiveProgressBanner` | liveBanner |
| `InlineStatusToast` | toast |

## reduced-motion / CI

- CSS reduce: toast · command-overlay/card · feedback-icon
- 로컬: `npm run audit:motion-reduced`
- CI(런타임 강제): `npm run audit:motion-reduced:ci`  
  (`--strict` → BASE 필수, 실패 시 exit 1). 또는 `STRICT_MOTION_RUNTIME=1`.

## Do / Don't

**Do** — 상태 변화에만 모션 · 공통 `ops-feedback` 톤  
**Don't** — 토스트마다 다른 border 색 · success에 spring overshoot
