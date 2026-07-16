# UI Motion Policy

대시보드 UI 애니메이션은 **짧고 일관된** motion token을 사용합니다.  
토큰 정의: `src/lib/ui/motion-tokens.ts`, Tailwind 헬퍼: `src/lib/ui/motion-classes.ts`, CSS: `src/app/globals.css` (`--motion-*`).

## Duration

| Token | ms | 용도 |
|-------|-----|------|
| `fast` | 120 | tooltip, button/badge hover |
| `normal` | 200 | dialog, dropdown, sheet, command overlay, toast enter |
| `moderate` | 280 | collapsible expand, barn list panel |
| `emphasis` | 360 | heat morph, 강조 전환 |
| `exit` | 150 | toast exit, view crossfade |
| `view` | 150 | map ↔ list 패널 opacity |

## Easing

- `standard` — 일반 transition
- `enter` — 등장 (decelerate)
- `exit` — 퇴장 (accelerate)
- `emphasis` — 강조 morph

## Surface classes

| Class | 컴포넌트 |
|-------|----------|
| `ui-motion-toast` | `InlineStatusToast` |
| `ui-motion-nav-overlay` | `NavigationLoadingOverlay` (spinner) |
| `ui-motion-modal-backdrop` / `ui-motion-modal-panel` | bulk apply modal |
| `ui-motion-command-overlay` / `ui-motion-command-card` | `CommandPipelineOverlay` |
| `settings-collapsible-*` | `SettingsCollapsibleSection` |
| `ui-motion-soft-refresh-bar` | `SoftRefreshProgress` |

## shadcn portals

Dialog, Dropdown, Select, Tooltip — `motionClass.portalEnter` + `duration-motion-*`.

Bottom sheet (`BarnPanelBottomSheet`) — `motionClass.sheetEnter` + `duration-motion-moderate`.

## prefers-reduced-motion

`globals.css`에서 `--motion-duration-*`를 `0ms`로 덮어쓰고, motion utility class의 animation/transition을 비활성화합니다.

## Phase map

- **Phase 0** — tokens, CSS vars, this doc
- **Phase 1** — surfaces (sheet, overlay, shadcn, bulk modal)
- **Phase 2** — farm domain (collapsible, toast, view crossfade)
- **Phase 3** — micro (button/badge transitions, nav overlay, soft refresh)
