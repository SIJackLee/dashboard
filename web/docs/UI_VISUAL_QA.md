# UI Visual QA (수동)

기준일: 2026-07-30 · 대상: `dashboard/web` 농장 허브

## 판정

**아직 고급스럽지 않음.**  
토큰·가드·H1–H5는 “시스템 1.0”이지만, 화면 인상은 운영 도구에 가깝고 브랜드·면·리듬의 고급감은 부족하다.

## 체크리스트 (로컬)

| # | 화면 | 확인 | 결과 |
|---|------|------|------|
| 1 | 로그인 brand 스플래시 | presence(~1.2s)로 과도하게 길지 않은지 | |
| 2 | 그리드/목록 | 크롬 채도 낮음 · 숫자·알람만 선명 | |
| 3 | 차트 | spring/과한 scale 없음 · 채널색 일관 | |
| 4 | 컨트롤러 카드 | 온도=`channel-temp` · 설정밴드=`channel-info` · warn=`amber/status` | |
| 5 | ARIA 탭 | idle 호흡 · think=`channel-info` · **스테이지/도크가 모니터링과 구분** | |
| 6 | 명령 ACK | ops-feedback 톤 · reduced-motion 시 정적 | |

## 고급감 갭 (후속 후보)

1. **면·여백** — **갭1 적용** (`dashboardHubSurface`: well → tile → metricPocket · 그리드/목록 간격↑).
2. **타이포 리듬** — **갭2 적용** (`dashboardReadout` · 숫자/단위/라벨 분리). **맵 카드는 `--density-map-value*` 고정** (readout 재사용 회귀 금지 · `verify:ui-density`).
3. **채도 잔향** — violet/온도 orange는 제거·가드됨. 구역별 톤이 다시 섞이면 재스캔.
4. **ARIA 대비** — **갭4 적용** (`dashboardAriaShell` · stage/glow · title/eyebrow · dock primary ring). 잔여: 응답 카피 블록 톤은 프로토콜 문장과 분리해 필요 시만.
5. **다크/라이트 비대칭** — **갭5 적용** (`--surface-*` · dark muted≤card · muted-foreground↓ · ARIA glow 테마 분리).

6. **면 종류** — [UI_SURFACES.md](./UI_SURFACES.md). 덮개는 Status film(E). 유리 테 적용. Overlay(F) frost와 섞지 않음.

→ 신규 H6는 **승인 전 착수 금지**. 갭은 이 문서에만 누적.

## 동결과의 관계

시스템 토큰·가드는 동결(`UI_MOTION` · design-animation-agent).  
고급화는 “새 이펙트 추가”가 아니라 위 갭을 **승인된 소단위**로만 줄인다.
