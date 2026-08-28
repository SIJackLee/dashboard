# UI Surfaces (종류 · Glass 전 정본)

대시보드 UI는 축(H1–H5)과 **면 종류**를 같이 본다.  
Elevation 단(0~3)만으로는 덮개·히트맵·델린·시트가 한 덩어리로 섞인다.

관련: [UI_ELEVATION.md](./UI_ELEVATION.md) · [UI_CHROMA.md](./UI_CHROMA.md) · [UI_DENSITY.md](./UI_DENSITY.md) · [UI_MOTION.md](./UI_MOTION.md) · [UI_FEEDBACK.md](./UI_FEEDBACK.md) · [UI_ARIA_PRESENCE.md](./UI_ARIA_PRESENCE.md)  
코드: `dashboardElevation` · `dashboardUi` · `dashboardChroma` · `dashboardHubSurface` (`src/lib/ui/dashboard-page-ui.ts`)  
프리미티브: `src/components/ui/` · 농장: `src/components/farm/`

Glass(서리·투시)는 **이 표의 종류를 고른 뒤에만** 넣는다. 신규 글로우·무한 펄스·H6는 별도 승인.

## 이미 있는 축 (바꾸지 않음)

| 축 | 규칙 | 토큰 |
|----|------|------|
| Brand | 선택·CTA만 | `--primary` |
| Status | 정상·주의·위험 | `--status-ok\|warn\|danger` + `-ink` |
| Channel | 온·습·모터 | `--channel-temp\|hum\|motor\|info` |
| Density | 목록 readout · 맵 `--density-map-value*` · 덮개 `valueLg` | `dashboardTypography` / `dashboardReadout` |
| Elevation | 0 바탕 · 1 우물 · 2 카드 · 3 오버레이 | `dashboardElevation` |
| Motion | L1 `--motion-*` · L2 `motionClass` | `UI_MOTION.md` |
| Chroma | 크롬 낮음 · 데이터·알람 높음 | `dashboardChroma` |

## 면 종류 (8)

| 코드 | 이름 | 하는 일 | 대표 | 면 | 색 |
|------|------|---------|------|----|----|
| **A** | Chrome | 찾아가기 | 탑바, 뷰 탭, 하단 내비, 헤더 도구 | 바탕·border | 낮은 채도. status 솔리드 금지 |
| **B** | Document | 본문 그릇 | `SectionCard`, 설정 카드, `dashboardElevation.card` | 단 2 | `bg-card`. 안에 카드 겹쌓기 금지 |
| **C** | Well | 격자 우물 | 필드 그리드 배경, `hubSurface.well` | 단 1 | `--surface-well` |
| **D** | Tile | 한 컨트롤러/축사 칸 | `FarmMapCard`, `hubSurface.tile` | 단 2 | `bg-card` + 약한 ring. 열리면 테두리에 판정색 |
| **E** | Status film | 판정을 면으로 | 덮개, 왼쪽 현황, 모델 칸 틴트 | 타일 **위** | `--status-*`만. 채널색 금지 |
| **F** | Overlay | 떠서 가림 | Dialog, 시트, 드롭다운, FAB 패널 | 단 3 | `bg-popover`. 기존 `backdrop-blur`는 여기만 |
| **G** | Feedback | 적용 결과 | 토스트, 명령 오버레이, 일괄 배너 | 단 3 float | `opsFeedbackTone` |
| **H** | Presence | 델린만 | 뱃지 | 예외 | status 톤. 덮개에 복제 금지 |

숫자·차트 잉크는 면이 아니다. 채널/status 토큰으로 **글자·선·셀**만 칠한다.

## 컴포넌트 맵

| 묶음 | 경로 | 기본 종류 |
|------|------|-----------|
| 프리미티브 | `components/ui/` (Button, Card, Dialog, Input, Select, Slider, Table, Tabs, Tooltip…) | A 컨트롤 · B 카드 · F 대화 |
| 허브 셸 | `farm-dashboard-shell`, `dashboard-viewport-shell`, 탑바 | A |
| 필드 격자 | `barn-table`, `farm-field-status-grid`, `farm-map-card` | C 우물 + D 타일 |
| 덮개 | `controller-env-cover`, `cover-reveal-overlay` | **E** |
| 차트 | `farm-chart-view`, `trend-chart`, `severity-heatmap` | B + 데이터 잉크 |
| 모델 | `farm-plan-view`, `farm-plan-field-canvas` | 지도 + E 틴트 |
| 시트 | `barn-panel-bottom-sheet`, `farm-plan-dock-sheet`, 모바일 시트 | F |
| 명령 | `command-pipeline-overlay`, `bulk-live-progress-banner` | G |
| 델린 | `delin-env-badge` | H |
| 운영 | `/admin/ops`, `opsTypography` | B · 밀도는 허브 2× 없음 |

## Glass 전에 맞출 것

1. **덮개는 E다.** 지금은 불투명 면 + 유리 테. F의 `bg-card/95` + blur를 덮개에 복사하지 않는다.
2. **이미 있는 blur는 F·H·G다.** 헤더, Dialog, 시트, FAB, 명령 카드, 델린 뱃지. 새 토큰 없이 덮개에 넣으면 종류가 섞인다.
3. **채도 계단은 E·히트맵 셀만.** 크롬(A)·카드(B) 배경을 status 솔리드로 바꾸지 않는다.
4. **한 타일(D) 안에 단 2 카드를 또 쌓지 않는다.** 덮개를 걷으면 게이지는 포켓(C/metricPocket)이다.
5. **알림 헤더 버튼** `topHeaderActionBtnAlert`의 `red-*` 유틸은 status 토큰으로 맞출 후보(크롬이 알람을 흉내 냄).
6. **델린 뱃지**는 H 전용. 덮개 Glass 후보에서 뺀다.

## Glass를 허용하는 자리 (승인 후)

| 종류 | Glass | 이유 |
|------|-------|------|
| A Chrome | 금지 | 크롬은 낮고 불투명 |
| B Document | 금지 | 본문은 카드 면 |
| C Well | 금지 | 우물은 깔개 |
| D Tile | 금지 | 타일 자체가 유리면 안 됨. 위는 E |
| **E Status film** | **유리 테** | 면은 불투명. 위 `--status-film-rim-hi` · 아래 `--status-film-rim-lo`. 서리(블러)는 별도 승인 |
| F Overlay | 유지 | 이미 popover frost |
| G Feedback | 유지 | 이미 float |
| H Presence | 유지 | 델린만. 덮개에 이식 금지 |

E 덮개: `--status-*` 불투명 면 + `dashboardChroma.statusFilmGlassRim`. 흰 글자·무한 글로우·새 easing 없음. 잉크는 `--status-*-ink`. 서리 막(블러)은 아직 없음.

## 검증

- 면·그림자: `npm run verify:ui-elevation:strict` (게이트는 `verify:design`에 밀도·모션)
- 밀도: `npm run verify:ui-density`
- 모션: `npm run verify:motion`

새 면 종류를 만들 때는 이 문서 표를 먼저 고치고, 그다음 프리셋·컴포넌트.