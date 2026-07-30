관련: [UI_MOTION.md](./UI_MOTION.md) · [UI_ELEVATION.md](./UI_ELEVATION.md)

# UI Density (T2)

대시보드 **comfortable / compact** 밀도 모드.

## 모드

| 값 | 의미 |
|----|------|
| `comfortable` (기본) | PC `md`에서 타이포·컨트롤 ≈ 기존 2× 스케일 |
| `compact` | PC에서도 모바일급 조밀 스케일 (`--density-*-md` 축소) |

- 저장: `localStorage.dashboard-density`
- DOM: `html[data-density="comfortable"|"compact"]`
- 토글: 헤더 도구 `data-tour-id="header-density"`

## 토큰

`globals.css` `:root` / `html[data-density="compact"]` 의 `--density-*`.

역할별 클래스는 `dashboardTypography` · `dashboardControl` · `dashboardUi` · `densityClass` 가  
`text-[length:var(--density-…)]` / `h-[length:var(--density-control-h…)]` 로 참조.

인라인 `text-[1.75rem]` / `1.625rem` 금지 — `npm run verify:ui-density`.

`opsTypography` / farm 차트 내부 리터럴은 이미 조밀 — density 토큰 밖.

## API

```ts
import { applyDensity, readDensityFromDom } from "@/lib/ui/density";
import { dashboardTypography, dashboardReadout } from "@/lib/ui/dashboard-page-ui";
```

## 갭2 — 계기판 타이포 (`dashboardReadout`)

허브 온·습도 등 **주 수치**와 단위/라벨을 분리한다.

| 역할 | 키 | 요지 |
|------|-----|------|
| 주 수치 | `value` / `valueLg` | `font-mono` · `tabular-nums` · `--tracking-readout` |
| 단위 | `unit` / `unitBare` | sans · 더 작은 `--density-readout-unit*` · muted |
| 라벨 | `label` | 메타 크기 · `--tracking-readout-label` |

CSS: `--density-readout*` · `--tracking-readout*` (`globals.css`, compact에서 md 축소).  
적용: 목록 `MetricValue`, 일반 EnvChip.  

### 맵 카드 수치 (회귀 금지)

그리드 `FarmMapCard` / `EnvChip valueOnly` 는 **`--density-map-value*`** 만 사용한다.

| 금지 | 이유 |
|------|------|
| `gridCellValue*` → `dashboardReadout.value/valueLg` 재사용 | readout이 작아 그리드가 “빈약한 카드”로 보임 (2026-07-30 회귀) |

`dashboardUi.gridCellValueDefault|Compact` 는 `--density-map-value` / `--density-map-value-compact` 를 직접 참조.  
`npm run verify:ui-density` 가 토큰 존재 + alias 금지를 검사한다.

## 검증

헤더에서 밀도 토글 → 새로고침 후에도 유지.  
`npm run verify:design` (색·모션 회귀와 독립, 타이포는 수동 스모크 · **맵 카드 숫자 크기** 포함).
