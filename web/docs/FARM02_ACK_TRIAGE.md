# FARM02 ACK 점검 (읽기 전용 · 2026-08-06)

> **상태:** 원인 가설 확정(증거 있음) · 코드 패치/실명령 스모크는 **미실행**  
> **관련:** Phase A `applied 0` · C1로 과거 sent 57건 → `cancelled(stale_sent_24h)`

---

## 증상

| 항목 | FARM01 | FARM02 |
|------|--------|--------|
| `applied` | 1828 | **0** (전 기간) |
| `cancelled` | 130 (그중 stale 다수) | **57** (전부 과거 sent→C1) |
| `sent` 현재 | 0 | 0 |
| LIVE `v_iot_decoded_latest` | 수신 중 (예: 2026-08-06) | **last_rx ≈ 2026-08-04 23:01** · 행 2건만 |

대상 장비: MOD-1 · SP07:01:01 / SP07:01:02 · 채널 A/B/C · 전부 `SET_CHANNEL_THERMO` · `eqpmnCode=EC15`.

---

## 증거 (매칭 실패 ≠ 키 버그)

명령 예 (sent 후 stale cancel):

- setpoint **24.0** · deviation **3.5~7.0** · minVent **25** · maxVent **75~95**
- payload에 `wire_hex` 존재 → **C.py는 전송까지 완료** (가설 A 약함)

동일 시점 전후 LIVE thermo (SP07):

- setpoint **52~75** · deviation **~55** · minVent **25** · maxVent **100**
- `eqpmnCode` **EC15** → ACK 키 형식(`SP07:01:xx|A|EC15`)과 **일치**

→ `command_ack.thermo_matches_command` 기준이면 **값 불일치로 applied 불가** (가설 B/D 중 **B: 장비가 명령값을 반영하지 않음**이 주원인).

추가:

- 마지막 LIVE **23:01** 이후에도 명령이 **23:53**까지 전송됨 → 이후에는 uplink 자체가 없어 ACK 경로 단절.
- FARM02 LIVE가 **약 2일 정지** → 현재도 ACK 검증 불가(신규 스모크 전 수신 복구 필요).

---

## 가설 판정

| ID | 내용 | 판정 |
|----|------|------|
| A | downlink 미도달 / C 미전송 | **낮음** (payload·sent_at·wire 존재) |
| B | 전송됐으나 장비/시뮬이 값 미반영 | **주원인** (LIVE≪명령값) |
| C | 키/채널 불일치로 fetch 실패 | **낮음** (EC15·SP07 정합) |
| D | 스케일/필드 오차만 | **부분** — 편차가 커서 단순 반올림 이슈 아님 |

코드상 channel 명령은 exact key만 보고 fallback 없음(`find_thermo_for_command`) — 이번 케이스에서는 키가 맞아 **패치 우선순위 아님**.

---

## Health C / 이력 스모크 (데이터·코드)

| 체크 | 결과 |
|------|------|
| 전역 `sent` | **0** → `c.cmd.sent_stuck` critical 잔존 없음 |
| 24h 창 | **applied 25만** (FARM01) · cancelled/stale는 창 밖 |
| `classifyCommandFailure` | `cancelled`는 실패 아님 → stale를 “sent 미 applied”로 안 올림 |
| 최신 이력 20 | FARM01 `applied` 위주 |

브라우저 Prod 로그인 스모크는 미실시(인증 필요). 데이터 기대값은 위와 일치.

---

## 다음 (승인 후)

1. FARM02 **uplink 복구** 확인 (RS/시뮬/현장) — last_rx가 오늘로 올 것  
2. 복구 후 **실명령 1건** 스모크 (setpoint 소폭) → sent→applied 여부  
3. 여전히 미반영이면 **현장/시뮬 제어 경로** 이슈로 이관 (대시보드 ACK 코드 변경 보류)

---

## 재확인 (2026-08-06 · 승인 1번)

| 항목 | 결과 |
|------|------|
| LIVE last_rx | 여전히 **2026-08-04 ~23:01** (age ≈ **1d 3h**) |
| raw | `last_raw` 동일 시각 · **08-04 이후 신규 패킷 없음** (48h 창에 과거분 141행만) |
| 실명령 1건 | **미실행** (수신 복구 전제 미충족 · 무의미한 downlink 방지) |
