# UI Feedback (H4 — 운영 피드백)

명령은 **접수 → 전송 → 확인** 세 단입니다 (`pending` → `sent` → `applied`). `applied`는 command_ack가 LIVE 설정과 명령을 맞춰 올린 적용 확인입니다. 필드 격자에서는 해당 **환경 덮개** 값 아래에 채널별 잉크 게이지를 붙입니다.

관련: [UI_MOTION.md](./UI_MOTION.md) · [UI_CHROMA.md](./UI_CHROMA.md) · [UI_ELEVATION.md](./UI_ELEVATION.md)  
코드: `src/lib/ui/ops-feedback.ts` · `src/lib/farm/apply-queue.ts` · `controller-env-cover.tsx` · `command-pipeline-overlay.tsx` · `command-confirm-overlay.tsx` · `inline-status-toast.tsx`

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

필드 **환경 덮개**는 명령을 보내지 않은 칸에는 스트립을 그리지 않는다. 최근 1시간 접수·전송·확인 티켓이 있는 컨트롤러만 값·알람 띠 아래에 채널 A/B/C 행을 올린다. **축사·컨트롤러·채널당 가장 최근 1건**만 큐에 남긴다. 1시간이 지나면 티켓을 내린다. 좌하단 상주 도크와 와이어 헥스는 운영 화면에 두지 않는다. 델린은 오른쪽 아래.

## 적용 큐 (필드 덮개)

| 화면 단계 | 의미 |
|-----------|------|
| 접수 | 대기열 등록 |
| 전송 | 현장 송신 (`sent`) |
| 확인 | 적용 확인 (`applied`) |

게이지는 덮개 잉크(`currentColor`)와 투명도만 쓴다. 3단 채움은 `scaleX` + `duration-motion-moderate`로 이어 간다. 오른쪽은 로딩 도넛, `applied`면 체크 후 `exit`로 해당 행을 내린다.

## 명령 이력 (컨트롤러 전용 차트)

큐(덮개 스트립)는 **최근 1시간**의 접수·전송·확인이다. 차트 명령 이력은 **적용된 명령만** 그 구간에 남긴다. 측정 추이(온·습·모터)와 **한 SVG에 쌓지 않는다.** 집계 트리 **컨트롤러 행 오른쪽 「명령」** 토글로 열고, 측정 그래프 **아래**에 A/B/C 세 행을 둔다. 가로 시각·기간은 추이와 같다. 기본(끔)에서는 측정 그래프만 보여 세로가 짧다. 최근 ~1시간은 시간 칸이 붙어 점으로 읽기 어려우니 필드 덮개 스트립을 본다.

| 축 | 의미 |
|----|------|
| 가로 | 통합 추이와 같은 시각 |
| 세로 | 채널 A · B · C (각 행: 위=온도구간 0–30℃, 아래=환기구간 0–100%) |

적용 시점부터 같은 채널의 다음 적용까지 온도·환기 띠를 **유지**한다. 측정 온도·모터 그래프에는 명령 구간을 겹치지 않는다.

**상호작용 (온·습·모터와 동일 계약)**

- **탭/클릭** → 데이터 카드 **고정**(홀드). 유지띠와 카드는 **점선**으로 이어집니다.
- **같은 띠 재클릭** · 카드 닫기 · 차트 밖 클릭 → 해제.
- **호버** → 임시 카드(이미 핀된 띠는 호버 카드 숨김).
- **드래그** → 위 측정 추이와 **같은 시간 구간**을 확대합니다. 측정 Y밴드(온도·습도·모터)는 바꾸지 않습니다.
- **URL** `chartCmd=1`: 명령 전용 차트 켬. 옛 `chartYBand`의 `command`는 같은 의미로 읽습니다.

설정온도·편차·환기 요약을 카드에 둔다. 접수·전송·실패·취소는 그리지 않는다. 집계 범위와 같은 적용 명령만 본다.

적용 유지띠는 채널 행에 둔다. 접수·전송은 차트에 그리지 않는다(덮개 큐만). 행 라벨(A/B/C)은 온·습·모터 눈금과 같은 우측. 점·+N 클러스터·본문 카드 겹쌓기·primary 점·임의 duration 없음. 필드 덮개 적용 스트립은 차트와 달리 **덮개 잉크만** 쓰고 채널·상태 hue를 올리지 않는다.

코드: `src/lib/farm/command-hit.ts` · `command-hold-bands.ts` · `trend-chart-event-lane.tsx` · `use-trend-scope-gesture.ts`

## 컴포넌트

| UI | 레이어 |
|----|--------|
| `CommandPipelineOverlay` | FEEDBACK_Z.overlay |
| `CommandConfirmOverlay` | overlay — 전송 전 승인(자동 닫힘 없음) |
| `ControllerEnvCover` 채널 스트립 | 필드 칸 — 적용 중인 컨트롤러만 |
| `InlineStatusToast` | toast |

## reduced-motion / CI

- CSS reduce: toast · command-overlay/card · feedback-icon
- 로컬: `npm run audit:motion-reduced`
- CI(런타임 강제): `npm run audit:motion-reduced:ci`  
  (`--strict` → BASE 필수, 실패 시 exit 1). 또는 `STRICT_MOTION_RUNTIME=1`.

## Do / Don't

**Do** — 상태 변화에만 모션 · 공통 `ops-feedback` 톤 · 적용 큐는 정식 명칭만  
**Don't** — 토스트마다 다른 border 색 · success에 spring overshoot · `applied` 전 「적용 완료」
