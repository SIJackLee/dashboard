# IoT archive · slim · thermo flat (2026-08-05)

## Archive DROP 정책 (확정)

| 단계 | 시점 |
|------|------|
| HOT | `mesure_at` 월 파티션, 최근 ~30일 |
| detach → `archive.*_archived` | 월 상한 ≤ now−30d (`cleanup_iot_retention_30d`) |
| **DROP archive** | 월 종료일 ≤ now−**60d** = retention 30d + soak **30d(1개월)** |

함수: `cleanup_iot_archive_drop(30, 30)` · cron `cleanup-iot-archive-drop-daily` 03:45 KST.

## fat→slim backfill

전 행 `decoded_json` → `v0c-slim-1` (`tempsC` + `channels`만).  
실측: 대부분 slim · avg JSON ~509B.

## 서모 flat

컬럼: `setpoint_temp`, `temp_deviation`, `min_vent_pct`, `max_vent_pct`  
`v_iot_dashboard_list`는 flat만 사용 (JSON extract 제거).  
Edge decode-batch가 Channel A thermo를 flat에 기록.
