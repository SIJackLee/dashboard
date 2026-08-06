# other-tables 용량 스캔 (2026-08-06)

> raw/decoded·명령 보관 트랙 이후 · **읽기 전용**  
> decoded 파티션 합산은 parent `0 bytes`로 보일 수 있음 · raw는 단일 테이블

## 상위 (public 일반 테이블)

| 테이블 | 크기 | est rows | 비고 |
|--------|------|----------|------|
| `iot_room_state_raw` | **22 MB** | ~9k | 이미 30d retention |
| `ctrl_thermo_command` | ~2.1 MB | ~2k | C1/C2·키/인덱스 적용됨 |
| `profiles` | 232 kB | 7 | 마스터 |
| `push_outbox` | 96 kB | 11 | 작음 |
| `aria_turn_log` | 96 kB | 15 | 7d cleanup cron 있음 |
| `farm_module_alarm` | 80 kB | 6 | 작음 |
| `iot_room_state_decode_failed` | 80 kB | 0 | 비움 |
| `iot_decoded_last_value` | 64 kB | 13 | LIVE 보조 |
| `user_push_device` | 64 kB | 4 | |
| 기타 마스터/설정 | ≤56 kB | — | |
| `farm_alarm_notify` | 48 kB | **0** | SMS 대기 |
| `health_command_checkpoint` | 24 kB | 0 | |

## 다음 후보 판단

| 우선 | 테이블 | 이유 | 제안 |
|------|--------|------|------|
| — | raw / decoded / command | 트랙 완료 | 유지·관찰 |
| 낮음 | `push_outbox` | 행 적음 | 실패/잔존 TTL만 문서화 여지 |
| 낮음 | `aria_turn_log` | cron 있음 | 추가 작업 불필요 |
| 보류 | `farm_alarm_notify` | 빈 테이블 · SMS 미오픈 | 제품화 시 retention |
| 불필요 | 마스터류 | 성장 없음 | — |

**결론:** raw/decoded/command 외 **당장 용량 위생 대상 없음**. 다음은 제품 기능(푸시/SMS) 열릴 때 retention을 같이 설계.
