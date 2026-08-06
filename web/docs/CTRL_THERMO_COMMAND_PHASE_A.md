# ctrl_thermo_command — Phase A 관측 (2026-08-06)

> **범위:** 읽기 전용 · DELETE/cron 없음  
> **Canvas:** `ctrl-thermo-command-phase-a.canvas.tsx`  
> **다음:** Phase B 보관·`sent` TTL 정책 합의

---

## A1 · Status 분포

| status | n | % | older 7d | older 30d |
|--------|---|---|----------|-----------|
| applied | 1828 | 90.7% | 1501 | 0 |
| sent | 182 | 9.0% | 0 | 0 |
| cancelled | 5 | 0.2% | 5 | 0 |
| pending / failed | **0** | — | — | — |

CHECK 허용: `pending|sent|applied|failed|cancelled` — 실데이터는 뒤 세 값(+미사용 pending/failed).

총 **2015행** · ~1.9 MB · 기간 2026-07-14 ~ 08-06.

## A1 · `sent` 체류 (stale)

| 지표 | 값 |
|------|-----|
| sent_n | 182 (전부 `sent_at` 있음) |
| avg / p50 / p90 / max 연령 | **91.7h / 44.2h / 161.7h / 161.7h** |
| ≥1h / ≥24h / ≥48h | **182 / 182 / 80** |
| `ttl_sec` | 전부 **300** (5분) — C 전송 창 · **DB 자동 cancel 없음** |

→ TTL(5분)을 훨씬 지난 **좀비 sent**. ACK(`command_ack`: LIVE thermo 일치 → applied) 미발생.

농장별 sent: FARM01 **125** · FARM02 **57** (FARM02는 applied **0** — 전량 sent만).

## A2 · action · 일별

| action | n |
|--------|---|
| SET_CHANNEL_THERMO | 1694 |
| SET_CTRL_THERMO | 321 |

| day KST | n | applied | sent | cancelled |
|---------|---|--------|------|-----------|
| 07-24 | 1204 | 1199 | 0 | 5 | QA 스파이크 |
| 07-30 | 250 | 200 | 50 | 0 |
| 07-31 | 30 | 0 | 30 | 0 |
| 08-04 | 195 | 100 | 95 | 0 |
| 08-05 | 34 | 27 | 7 | 0 |
| 08-06 | 25 | 25 | 0 | 0 |

## A3 · 상태 사전

| status | 의미 |
|--------|------|
| pending | (스키마 허용) 미전송 대기 — 현재 미사용 |
| sent | C가 MQTT/전송 완료 · applied 대기 |
| applied | uplink thermo가 명령값과 일치 (D/command_ack) |
| failed | (스키마 허용) 전송/적용 실패 — 현재 미사용 |
| cancelled | 취소 |

전이: insert → **sent** → **applied** · 또는 **cancelled**.

## A4 · 소비자 맵

| 소비자 | 창/limit | 비고 |
|--------|----------|------|
| 적용 API · ACK 폴링 | 단건 id | `controllers/actions.ts` |
| 명령 이력 UI | limit **20** | `commands.ts` |
| thermo settings map | limit **500** | LIVE fallback |
| Health C 그래프 | **24h** | `fetch-command-health` |
| EC2 C.py | pending/sent poll | downlink |
| command_ack | sent → applied | RS raw 경로 |
| health_command_checkpoint | FK CASCADE | 실패 검수 |

## Phase A 결론 (정책 제안용 · 미확정)

1. **용량:** 30일 초과 0 · 당장 DELETE 급하지 않음.  
2. **위생:** `sent` 182건은 TTL 5분 대비 **전원 ≥24h stale** → Phase B에서 **expired/cancelled 정리** 검토 가치 큼 (삭제보다 상태 전이 권장).  
3. **FARM02:** applied 0 · sent만 → ACK/시뮬/실장비 정합 별도 점검.  
4. **보관:** B0 관측 유지 가능 · HOT 90일 등은 Phase B 합의.
