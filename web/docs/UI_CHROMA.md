# UI Chroma (H3 — 데이터 퍼스트)

대시보드 **채도 역할** — 시선은 숫자·알람·차트에, 크롬(헤더/탭/선택)은 낮게.

관련: [UI_MOTION.md](./UI_MOTION.md) · [UI_DENSITY.md](./UI_DENSITY.md) · [UI_ELEVATION.md](./UI_ELEVATION.md)  
코드: `dashboardChroma` · `dashboardUi` (`src/lib/ui/dashboard-page-ui.ts`)

## 규칙

| 역할 | 채도 | 예 |
|------|------|-----|
| **Chrome** | 낮음 | 헤더 활성, 뷰 탭, scope pill, 메뉴 선택, 하단 내비 |
| **Data channel** | 중~고 | `channelTint*` · 차트 시리즈 · 레이어 그룹 뱃지 |
| **Alarm / status** | 고 | `topHeaderActionBtnAlert` · `opsStatus` · destructive · status ring |

1. 크롬 선택에 `text-primary` + `bg-primary/10` 이상 쓰지 않는다 → `dashboardChroma` / 완화된 `headerActionBtnActive` 등.
2. 알람·이탈·채널 시리즈의 고채도를 크롬에 복제하지 않는다.
3. 빈 상태·스켈레톤은 muted + density 토큰 (`emptyState` · `skeletonBone`).

## 프리셋

| 키 | 용도 |
|----|------|
| `dashboardChroma.chromeActiveText` | 활성 탭/내비 라벨 |
| `dashboardChroma.chromeIdleText` | 비활성 + hover |
| `dashboardChroma.chromeSelected` | 선택 면(칩·행) |
| `dashboardChroma.viewTabPill` | 뷰 탭 슬라이딩 필 (카드 면 + ring, 라이트·다크 공통) |
| `dashboardChroma.emptyState` | 데이터 없음 문구 |
| `dashboardChroma.skeletonBone` | 로딩 본 |
| `dashboardChroma.statusFilmGlassRim` | 덮개(E) 유리 테 — 위 밝은 줄·아래 어두운 줄 |

`dashboardUi.headerActionBtnActive` · `menuItemActive` · `brandChip` · `scopePillActive` · `chartLayerActionBtn` 도 H3에서 **크롬 수준**으로 완화됨.  
`chartLayerBadge*` · `channelTint*` · `topHeaderActionBtnAlert` 는 **데이터/알람** — 유지.

## Do / Don't

**Do** — 차트 시리즈·알람 배지·심각도 링에 채널/status 색  
**Don't** — 탭 활성에 solid primary, 헤더 전체에 primary/15 배경 남발

모델 평면의 컨트롤러 구간은 `--plan-cover-0` … `5` (인접만 다르게). `channel-temp|hum|motor` 를 구간 식별에 쓰지 않는다. 생성에서 칸 안쪽 틴트는 필드 카드·히트맵과 같다. `--status-ok|warn|danger`는 **채도 계단**(정상 `#6f9e8a` 낮음 / 주의 `#f59e0b` 유지 / 위험 `#e11d2a` 높음). 덮개 글자는 `--status-*-ink` (같은 색상각·더 진함). 브랜드 `--primary`와는 분리.

채널 hue는 status와 겹치지 않게 둔다: temp ≈ 15(와인) · motor/fan-intake ≈ 120(올리브) · hum 230 · exhaust 295 · supply 165. 채도는 채널 중 · 주의/위험 고. 차트는 `var(--channel-*)`만. 온도 설정±편차 밴드는 primary가 아니라 `color-mix(…, var(--channel-temp), white)`로 **같은 색상각·명도만** 올린다.

## 변경 시

문서 + `dashboardChroma` / 관련 `dashboardUi` 프리셋을 함께 갱신.
