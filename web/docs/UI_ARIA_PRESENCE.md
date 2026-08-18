# UI ARIA Presence (H5 + 갭4)

브랜드 기억점은 **로그인 스플래시**와 허브 **DELIN 뱃지**(현장·차트·모델 우측 하단)에 둔다.  
전용 델린 탭은 없다. 오브·도크 셸은 코드에 남기되 허브에 마운트하지 않는다.

## 경계 (Agent 충돌 방지)

| 소유 | 허용 | 금지 |
|------|------|------|
| **디자인 & 애니메이션** | `.aria-orb-*` / `.aria-shell-*` / `.aria-stage-*` / `.aria-dock-in`, `--motion-aria-*`, `dashboardAriaShell`, `farm-aria-view` **셸 클래스**, dock 크롬, `AriaStageLayout` 모션 | `lib/aria` 판단, JUDGE/SAY/REC, voice-report **API·상태 머신** |
| **[프로토콜] ARIA** | 판단·문장·음성 파이프라인 | 임의 장식 모션·색 하드코딩 |

교차 시 셸 클래스만 디자인 Agent, 입력/ASK 로직은 프로토콜 Agent.

## 스테이지 포커스 (답변 시퀀스 A–D · P1)

| 상태 | 오브 | 결과면 |
|------|------|--------|
| `idle` (답변 전) | 중앙 전폭 | 접힘(폭 0) |
| `listen` / `think` | 중앙 · think는 분석 morph | 접힘 |
| `speak` / 답변 유지 | 하단 도크 우측 (축소·이동 동시) | 중앙 **scale-up** 리빌 |

시퀀스: 질문 → think → 답변 후 **dock**(하단 도크 우측) → (추이 데이터 ready 대기) → **chart** → **scopeDemo** → ready.
전용 탭이 없으므로 이 시퀀스는 허브에 마운트되지 않는다. 코드만 유지.
모션 토큰: `--motion-aria-dock-duration` 1400ms · `--motion-aria-reveal-duration` 1100ms.
`data-aria-reveal-beat` = `dock` \| `chart` \| `scopeDemo` \| `ready`.
`data-aria-dock` = `center` \| `dock` (축소 오브는 하단 입력 도크 우측).
입력 도크는 스테이지 **오버레이**(레이아웃 높이 비점유) · 상단 핸들로 위치 이동 가능.

결과면 구성: 짧은 답변 요약 · evidence 칩 · **통합 추이 제자리**(온도 포커스는 scopeDemo 후) · 보조「차트 탭에서 전체 보기」.
KPI 4카드·축사 CompactLineChart는 쓰지 않음(캔버스 정렬). 도크는 말하기·칩만(`suppressAnswerSurface`).

### 모션 훅 (디자인 Agent)

| 클래스 / 토큰 | 역할 |
|---------------|------|
| `.aria-stage-metrics-hero` | 결과면 중앙 scale-up (`--motion-aria-stage-scale-from`) |
| `.aria-stage-orb-corner` | 오브 → 하단 도크 우측 (`--motion-aria-dock-duration`) |
| `.aria-answer-chart-preview` | 차트 프리뷰 단독 scale-up |
| `.aria-answer-stage-block` | 결과 블록 staggered |
| `.aria-orb-analyze-ring` / `-rev` | think 분석 morph |
| `.aria-stage-orb-center` | 대기·청취 중앙 |
| `data-aria-dock` | `center` \| `dock` (확인용) |
| `data-aria-reveal` | `none` \| `scale-up` (확인용) |

`prefers-reduced-motion: reduce` 시 stage 애니메이션·transition 비활성(배치 클래스만 유지).

### P1 확인지표

| 지표 | 기대 |
|------|------|
| 도킹 | speak 시 `data-aria-dock="dock"`, 오브가 **하단 도크 우측**에 남음 |
| 축소·이동 | 한 모션으로 위치+크기 변화 (페이드아웃 후 재출현 아님) |
| 결과면 | `data-aria-reveal="scale-up"`, 중앙에서 확대 (순수 페이드만 아님) |
| 타이밍 | dock ≈1400ms → chart ≈1100ms → scopeDemo ≈3200ms → ready |
| reduced-motion | 애니 없음, 즉시 `ready` |
| 도크 | 오버레이 · `data-testid="aria-dock-draggable"` 핸들로 이동 |

LIVE KPI: `fetchAriaFarmMetricsAction` → `buildFarmFacts` (답변 결과면 표시 중 30s 폴링).  
도크: 사운드/마이크 테스트는 **장치 테스트** 접기(기본 숨김, 하단 보조). TTS·말하기·텍스트는 유지.  
U1: 영문 풀네임은 타이틀 `title`만 · 스테이지 힌트 1줄 · 추천 질문 칩 3개(농장 어때?/위험만/환기는?) · CTA「말하기」강조.  
도크 Progressive disclosure: 상시=말하기·칩 · 「글로 묻기」접기 · 「옵션」(읽어주기·장치 테스트) 더 희미하게.  
U2: 스테이지에 통합 추이 제자리 + `chartHandoff` 스코프/온도 줌. 보조 CTA만 `view=chart` 딥링크. 로직: `delin-chart-handoff.ts`.  
U3–U4: 차트 companion·모바일 바텀시트는 **미마운트**(파일 삭제). 질문은 뱃지 범위 밖. 음성 도크 코드는 유지.

## P2 — 온도 레인 스코프

| 항목 | 동작 |
|------|------|
| 제스처 | **차트 위**(온도 레인) 드래그 → X구간 + Y밴드 스코프. 하단 brush는 **기간(24h/7d/30d)만** |
| 온도만 | 드래그 중심이 온도 밴드이면 `yBands=["temp"]` → 습도·모터 접힘·온도 레인 확장 |
| DELIN 스테이지 | speak 후 제자리 추이 · **알람 초과 연속 구간 전부**를 커버해 온도 스코프 (산포 hi/lo vs 임계, 다봉이면 첫~끝) |
| 시연 | `scopeDemo`에서 `TrendChart` `guidedXScopeGesture`로 **실 X스코프 draft** 클릭→드래그→`onXScopeCommit` (CSS 오버레이 아님) |
| handoff URL | 보조 CTA → `view=chart` + `chartYBand=temp` (±선택 `chartX0`/`chartX1`) |
| 확인 | `[data-aria-answer-mode="chart"]`, `[data-aria-stage-chart="1"]`, `[data-farm-chart-temp-focus="true"]` |

### P2 확인지표

| 지표 | 기대 |
|------|------|
| 스테이지 차트 | DELIN 탭 답변 후 중앙에 통합 추이 (`data-aria-answer-mode="chart"`) |
| 이중 답변 | 도크에 `delin-answer-card` 없음 (스테이지만) |
| 레인 스코프 | 온도 드래그 후 `data-farm-chart-temp-focus="true"` |
| brush 분리 | 하단은 기간 프리셋만 |
| 탭 이탈 | list/map/aria로 나가면 `chartYBand`/`chartX*` 제거 |

## 톤 대비

| Surface | 모션/면 | 목적 |
|---------|---------|------|
| 모니터링 UI | L1 `--motion-duration-*` (≤360ms) · hub well/tile | 숫자·알람이 주인공 |
| ARIA stage (갭4) | `dashboardAriaShell.stage` + `aria-shell-stage-glow` | 탭 전체가 브랜드 면 |
| ARIA orb idle | `--motion-aria-breathe-period` (3.6s), 스케일 0.96–1.05 · 링 3단 위상차 | 대기 호흡 |
| ARIA listen | 외곽 링 r/opacity ← 마이크 RMS · 중심 안정 · ambient pulse 약하게 | 상태만 더 선명 |
| ARIA orb 색 | idle/listen/speak=`primary` · think=`channel-info` · error=`destructive` | |
| ARIA dock (갭4) | `dashboardAriaShell.dock` · primary ring · overlay lift | 입력면 강조 |
| Dock / reply enter | `moderate` + `enter` | 패널 등장만 짧게 |
| Login splash | `--motion-duration-presence` (1200ms) | 브랜드 입장 |

## CSS / 프리셋

```
--motion-duration-presence
--motion-aria-*
.aria-shell-stage-glow
dashboardAriaShell.{ stage, stageGlow, title, eyebrow, hint, dock, … }
```

`prefers-reduced-motion: reduce` 시 presence·ARIA 주기는 0, `.aria-orb-*` / `.aria-dock-in` 애니메이션 `none`.  
스테이지 글로우는 **탭 진입 시 opacity fade-in**(`--motion-duration-moderate`) 후 정적 유지. `prefers-reduced-motion: reduce` 시 애니메이션 없음(배치는 유지).  
농장 표시명은 **헤더 농장 선택**만 — 스테이지 타이틀 아래 중복 없음.

## 검증

- `npm run verify:design`
- 수동: 현장·차트·모델 우측 하단 DELIN 뱃지·말풍선. 상단에 델린 탭 없음. `/farm?view=aria` → 현장
