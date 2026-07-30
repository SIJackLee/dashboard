# UI ARIA Presence (H5 + 갭4)

브랜드 기억점은 **ARIA 탭 프레즌스**와 **로그인 스플래시**에만 둔다.  
모니터링(그리드·목록·차트·명령)은 H1–H4 차분 톤을 유지한다.

## 경계 (Agent 충돌 방지)

| 소유 | 허용 | 금지 |
|------|------|------|
| **디자인 & 애니메이션** | `.aria-orb-*` / `.aria-shell-*` / `.aria-stage-*` / `.aria-dock-in`, `--motion-aria-*`, `dashboardAriaShell`, `farm-aria-view` **셸 클래스**, dock 크롬, `AriaStageLayout` 모션 | `lib/aria` 판단, JUDGE/SAY/REC, voice-report **API·상태 머신** |
| **[프로토콜] ARIA** | 판단·문장·음성 파이프라인 | 임의 장식 모션·색 하드코딩 |

교차 시 셸 클래스만 디자인 Agent, 입력/ASK 로직은 프로토콜 Agent.

## 스테이지 포커스 (페이즈1+)

| `data-aria-stage-focus` | 오브 | 지표 |
|-------------------------|------|------|
| `orb` (idle/listen/think) | 중앙 | listen/think 때 레일, idle 접힘 |
| `metrics` (speak) | 측면 축소 (`.aria-stage-orb-side`) | 전면 히어로 (`.aria-stage-metrics-hero`) |

### 모션 훅 (디자인 Agent)

| 클래스 | 역할 |
|--------|------|
| `.aria-stage-metrics-rail` / `-hero` | 지표 등장 |
| `.aria-stage-orb-center` / `-side` | 오브 축소·이동 |
| `.aria-stage-slide-body` | 슬라이드 페이지 전환 |
| `.aria-stage-metrics-panel[data-emphasized="1"]` | 답변 중 패널 강조 |

`prefers-reduced-motion: reduce` 시 stage 애니메이션·transition 비활성(배치 클래스만 유지).

슬라이드 페이지: 환경(온도·습도) · 그래프(축사별) · 현황(컨트롤러·이상). **암모니아 없음.**  
LIVE: `fetchAriaFarmMetricsAction` → `buildFarmFacts` (농장 선택 시 prefetch, 대화 중 30s 폴링).  
도크: 사운드/마이크 테스트는 **장치 테스트** 접기(기본 숨김). TTS·말하기·텍스트는 유지.

## 톤 대비

| Surface | 모션/면 | 목적 |
|---------|---------|------|
| 모니터링 UI | L1 `--motion-duration-*` (≤360ms) · hub well/tile | 숫자·알람이 주인공 |
| ARIA stage (갭4) | `dashboardAriaShell.stage` + `aria-shell-stage-glow` | 탭 전체가 브랜드 면 |
| ARIA orb idle | `--motion-aria-breathe-period` (3.6s), 스케일 0.92–1.08 | 대기 호흡 |
| ARIA listen/speak | active period/scale | 상태만 더 선명 |
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
스테이지 글로우는 **정적 그라데이션**이라 reduce에서도 유지.

## 검증

- `npm run verify:design`
- 수동: ARIA 탭이 그리드/목록과 다른 “브랜드 스테이지”로 보이는지 · dock이 일반 카드보다 또렷한지
