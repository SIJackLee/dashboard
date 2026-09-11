# UI Feedback (H4 — 운영 피드백)

명령은 **접수 → 전송 → 수신 → 확인** 네 단으로 안내합니다. 허브 왼쪽 아래 **적용 큐**(A 티켓)가 건마다 게이지를 보여 주고, 실측이 맞기 전에는 「적용 완료」로 닫지 않습니다.

관련: [UI_MOTION.md](./UI_MOTION.md) · [UI_CHROMA.md](./UI_CHROMA.md) · [UI_ELEVATION.md](./UI_ELEVATION.md)  
코드: `src/lib/ui/ops-feedback.ts` · `src/lib/farm/apply-queue.ts` · `apply-queue-dock.tsx` · `command-pipeline-overlay.tsx` · `command-confirm-overlay.tsx` · `inline-status-toast.tsx`

## 톤 (`opsFeedbackTone`)

| tone | 용도 | 색 |
|------|------|---|
| `ok` | 적용 성공 | `--status-ok` |
| `warn` | 부분 실패 · 주의 | `--status-warn` |
| `error` | 실패 | `--status-danger` (`--destructive` 별칭) |
| `info` | 안내 | border + foreground |
| `loading` | 적용 중 | muted + spin |

셸: `opsFeedbackShell` (= elevation float급 `shadow-lg`).

## 명령 파이프라인 모션

| phase | 모션 |
|-------|------|
| loading | 오버레이 fade |
| success / error | `.ui-motion-feedback-icon` soft scale-in (amplitude 토큰) |

허브 왼쪽 아래 **적용 큐**는 필드에서 명령을 보내지 않아도 항상 접기·펼치기를 둔다. 최근 1시간 접수·전송·수신을 올린다. 실측이 이미 맞아도 확인 티켓으로 남긴다. **축사·컨트롤러·채널당 가장 최근 1건**만 큐에 남긴다. 1시간이 지나면 티켓을 내린다. 건이 없으면 목록에 안내만 둔다.

## 적용 큐 (왼쪽 아래)

| 화면 단계 | 의미 |
|-----------|------|
| 접수 | 대기열 등록 |
| 전송 | 현장 송신 |
| 수신 | 장치 응답 |
| 확인 | 실측 일치 |

진행 중이던 건이 전부 확인되면 6.5초 뒤 핸들로 접힌다. 핸들은 비어 있어도 남는다. 최근 1시간 티켓은 접혀도 유지한다. 실패·시간 초과는 카드를 유지한다. 티켓에 장비로 나가는 15바이트 명령을 보여 준다. 델린은 오른쪽 아래.

## 명령 적중 (통합 추이 모터 아래)

큐는 **최근 1시간**, 적중은 **그 구간에서 맞은 이력**이다. 통합 추이 플롯 맨 아래(모터 아래) 행에 두고, 온·습·모터 레인과 겹치지 않는다. 가로 시각·기간은 추이와 같다. 최근 ~1시간은 시간 칸이 붙어 점으로 읽기 어려우니 적용 큐를 본다.

| 축 | 의미 |
|----|------|
| 가로 | 통합 추이와 같은 시각 |
| 세로 | 접수 → 전송 → 수신 → 확인 (위가 적중) |

**상호작용 (온·습·모터와 동일 계약)**

- **탭/클릭** → 데이터 카드 **고정**(홀드). 점과 카드는 **점선**으로 이어지고, 선택 링·SVG 강조가 붙는다.
- **같은 점 재클릭** · 카드 닫기 · 차트 밖 클릭 → 해제.
- **호버** → 임시 카드(이미 핀된 점은 호버 카드 숨김).
- **가로 드래그** → 시간 구간 줌(스코프). 레인 빈 곳·점 위 모두 가능. 짧은 탭만 핀.

설정온도·편차·환기 요약을 카드에 둔다. 실패·취소는 그리지 않는다. 집계 범위와 같은 명령만 본다. 점은 이전의 절반 크기.

확인은 `--status-ok`, 접수·전송·수신은 `--channel-info` 농도. 단계 라벨은 온·습·모터 눈금과 같은 우측. 본문에 카드 겹쌓기·primary 점·임의 duration 없음.

코드: `src/lib/farm/command-hit.ts` · `trend-chart-event-lane.tsx` · `use-trend-scope-gesture.ts`

## 컴포넌트

| UI | 레이어 |
|----|--------|
| `CommandPipelineOverlay` | FEEDBACK_Z.overlay |
| `CommandConfirmOverlay` | overlay — 전송 전 승인(자동 닫힘 없음) |
| `ApplyQueueDock` | liveBanner — 왼쪽 아래 티켓 |
| `InlineStatusToast` | toast |

## reduced-motion / CI

- CSS reduce: toast · command-overlay/card · feedback-icon
- 로컬: `npm run audit:motion-reduced`
- CI(런타임 강제): `npm run audit:motion-reduced:ci`  
  (`--strict` → BASE 필수, 실패 시 exit 1). 또는 `STRICT_MOTION_RUNTIME=1`.

## Do / Don't

**Do** — 상태 변화에만 모션 · 공통 `ops-feedback` 톤 · 적용 큐는 정식 명칭만  
**Don't** — 토스트마다 다른 border 색 · success에 spring overshoot · 확인 전 「적용 완료」
