# ctrl_thermo_command — Phase B 확정 (P1)

> **확정일:** 2026-08-06  
> **상태:** 정책 확정 · **C1+C2 적용 완료** (2026-08-06)  
> **근거:** [`CTRL_THERMO_COMMAND_PHASE_A.md`](./CTRL_THERMO_COMMAND_PHASE_A.md)  
> **구현:** [`CTRL_THERMO_COMMAND_PHASE_C.md`](./CTRL_THERMO_COMMAND_PHASE_C.md)

---

## 확정 내용 (P1)

| 항목 | 결정 |
|------|------|
| HOT (`applied` / `cancelled`) | **`created_at` 기준 90일** · 초과분 hard DELETE (`cleanup_ctrl_thermo_hot`) |
| stale `sent` | **`sent_at < now() - interval '24 hours'`** → `status = 'cancelled'` |
| 사유 기록 | `note` / `error_msg`에 **`stale_sent_24h`** (기존 값 있으면 append) |
| 소급 (C1) | **완료** — 182건 (FARM01 125 + FARM02 57) |
| archive 테이블 | 1차 **비채택** |
| 신규 status `expired` | **비채택** — `cancelled` 재사용 |
| FARM02 ACK | 정책과 **별도** 점검 티켓 |

### 비고

- 최초 C2 시점 90일 초과 행 = **0** (oldest ≈ 2026-07-14). cron은 창이 차면 자동 삭제.
- `ttl_sec`(300)는 C 전송 창으로 유지 · **DB 만료 기준으로 쓰지 않음** (24h 규칙).
- `health_command_checkpoint.command_id` → CASCADE DELETE.

---

## Phase C 진행

| 단계 | 상태 |
|------|------|
| C1 dry-run + 함수 + 소급 + 일 cron | **적용** (2026-08-06) |
| C2 HOT 90d DELETE 함수 + 일 cron | **적용** (2026-08-06) |
