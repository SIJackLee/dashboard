# UI Elevation

대시보드 **면(surface) 계층** — 라이트 모드에서 깊이감은 그림자보다 **배경 리프트 + border/ring** 위주.  
카드·그림자를 남용하지 않고 **2~3단**만 유지한다.

관련: [UI_MOTION.md](./UI_MOTION.md) · [UI_DENSITY.md](./UI_DENSITY.md) · `src/lib/ui/dashboard-page-ui.ts`

## 래더 (권장 4단 → 실제 사용 2~3단)

| 단 | 이름 | 배경 | 경계 | 그림자 (라이트) | 용도 |
|----|------|------|------|-----------------|------|
| **0** | Canvas | `bg-muted/30` (body) / `bg-background` | 없음 | 없음 | 페이지 바탕 |
| **1** | Recessed | `bg-muted/40` ~ `bg-muted/50` | `border` 선택 | 없음 | 스트립·칩 영역·보조 패널 (`sectionMuted`, `scopeBar`, `statCompact`) |
| **2** | Raised card | `bg-card` | `border` + (컨텍스트만) `ring-1 ring-foreground/15` | `shadow-sm` · **다크는 `shadow-none`** | 본문 섹션·컨텍스트 패널 (`section`, `contextPanel`, `statCard`) |
| **3** | Overlay | `bg-popover` / `bg-popover/95` | `border` + `ring-1 ring-foreground/10` | `shadow-md` ~ `shadow-lg` | 드롭다운·헤더 도구·차트 FAB·ARIA 패널 |

원칙:

1. **한 화면에 Raised(2)를 겹겹이 쌓지 않는다** — 카드 안에 또 `bg-card`+shadow 금지. 내부는 Recessed(1) 또는 flat border.
2. **라이트에서 카드 lift**는 `shadow-sm` + (필요 시) 약한 ring. 다크는 shadow 끄고 border/ring만.
3. **Overlay(3)만** `shadow-md`/`lg` 허용. 본문 카드에 `shadow-lg` 쓰지 않는다.
4. **호버로 elevation 올리지 않기** — `hover:shadow-*` 금지. 선택 가능 타일은 `dashboardElevation.interactiveHover`(ring). (`verify:ui-elevation`)

## 프리셋 (`dashboardElevation`)

| 키 | 단 | 클래스 요지 |
|----|----|-------------|
| `card` | 2 | `bg-card` + `shadow-sm` · dark `shadow-none` |
| `cardEmphasis` | 2 | + ring |
| `recessed` | 1 | `bg-muted/45` |
| `well` | 1 | hub 그리드·SP 우물 — `--surface-well` (갭1/5) |
| `tile` | 2 | hub 축사 타일 — `--surface-shadow-tile` + ring |
| `metricPocket` | 1 | 타일 안 주 지표 — `--surface-pocket` |
| `overlay` / `overlayStrong` | 3 | popover + `shadow-md`/`lg` |
| `float` | 3 | `bg-background` + `shadow-lg` (모달 셸·토스트) |
| `interactiveHover` | — | `hover:ring-*` only |

허브 면·여백 묶음: `dashboardHubSurface` (`well` / `tile` / `metricPocket` / `gridGap`).

## `dashboardUi` 매핑

| 프리셋 | 단 | 비고 |
|--------|----|------|
| `section` | 2 | ≈ `dashboardElevation.card` + pad |
| `contextPanel` | 2 | ≈ `cardEmphasis` |
| `sectionMuted` | 1 | ≈ `recessed` |
| `innerCard` / `chipCard` / `metricTile` | 1~2 경계 | border만, **shadow 없음** |
| `scopeBar` | 1 | `bg-muted/40` |
| `statCard` | 2 | shadow는 래퍼에 두지 않음(테두리만) |
| `headerToolsCard` | 1~2 | `bg-background` + border (패널 안 행) |
| 헤더 캐스케이드 / Tooltip / Dialog | 3 | `overlay` |

신규 UI는 `dashboardElevation` / `dashboardUi` 프리셋을 재사용한다. 임의 `shadow-*` + `bg-card` 조합을 새로 만들지 않는다.

검증: `npm run verify:ui-elevation`

## Z-index (오버레이만)

Elevation 단과 별개로, **떠 있는 UI**의 쌓임 순서:

| 대역 | 예 |
|------|----|
| `z-40` | 모바일 하단 내비, 투명 스크림 |
| `z-50` ~ `z-[60]` | 헤더 트리거, FAB, 차트 레이어 FAB |
| `z-[70]` ~ `z-[80]` | 차트 레이어 툴바·툴팁 |
| `z-[9990]` | 온보딩 투어 (최상위) |

본문 카드·섹션에는 z-index를 주지 않는다.

## 라이트 vs 다크 (갭5)

| | 라이트 | 다크 |
|--|--------|------|
| Canvas | cool muted 바탕 | `bg-background` (L≈0.145) |
| Recessed / well | `--surface-well` (muted 쪽) | muted **≤** card — 우물이 카드보다 어두움 |
| Card / tile | `bg-card` + `--surface-shadow-tile` + `--surface-ring` | shadow 없음 · 약한 ring만 · card L≈0.22 |
| Meta 글자 | `--muted-foreground` | L≈0.64 (구 0.70 — 눈부심↓) |
| ARIA stage | `--aria-stage-*` / `--aria-glow` | primary 글로우 약화 |

토큰: `--surface-well|pocket|ring|shadow-tile`, `--aria-stage-from|to`, `--aria-glow` (`globals.css`).

색 토큰(`--card`, `--popover`, `--muted`)은 `globals.css` — elevation은 **면의 역할**만 정하고 채널/status 문법을 따른다.

## Do / Don't

**Do**

- 페이지 = Canvas(0) → 섹션 = Raised(2) → 섹션 안 그룹 = Recessed(1) 또는 border-only
- 메뉴·시트·플로팅 = Overlay(3) + popover 토큰
- 컨텍스트만 강조할 때 `contextPanel` ring 사용

**Don't**

- 통계 타일마다 `shadow-md`
- 카드 중첩 + 각각 shadow
- 본문에 `bg-popover` (오버레이 전용)
- elevation으로 상태(정상/경고) 표현 — status/channel 색 사용

## 변경 시

1. 새 surface가 필요하면 먼저 기존 단(0~3)에 맞는지 확인.
2. 새 단을 추가하지 말고, `dashboardUi` 프리셋에 매핑.
3. 이 문서와 `dashboard-page-ui.ts` 주석을 함께 갱신.
