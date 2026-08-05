# IoT 보존(Retention) 옵션 — 설계만 (미실행)

Sprint C · **승인 전 코드/SQL 실행 없음.**  
대시보드 읽기는 이미 `latest` 뷰 + trend RPC만 사용한다. 보존은 디스크·WARM 스캔 상한을 위한 **후속 운영 과제**다.

## 전제 (합의)

- IoT는 **iot-cloud** 단일 프로젝트 (Free tier)
- 타 Supabase 프로젝트로 COLD 분리 **금지** (현 단계)
- 물리 테이블을 View로 바꿔 “저장 절약” **금지**
- 대시보드 계약: LIVE=최신 투영 · 차트=RPC 범위 · raw는 읽기 경로 비포함
- `DELETE` / `TRUNCATE` / 파티션 drop / cron 배포는 **명시 승인 후**

## 옵션 비교

| 옵션 | 내용 | 장점 | 위험·비용 | 권장 시점 |
| --- | --- | --- | --- | --- |
| **A. 관측만** | 디스크·행 수·RPC p95 모니터링 | 리스크 0 | 한도 임박 시 급함 | 지금~ |
| **B. 30일 ops 롤링** | `iot_room_state_decoded`(또는 raw) 30일 초과 삭제 job | 디스크·스캔 상한 | 복구 불가 · 차트 장기 공백 | 읽기 P0/P1 안정 후 + 승인 |
| **C. archive 테이블** | 오래된 행을 `*_archive`로 이동 후 본테이블 삭제 | 감사·드물게 조회 | 이중 저장 순간·이동 비용·RLS | B보다 신중할 때 |
| **D. 파티션** | 월/주 파티션 + 오래된 파티션 detach | 삭제 빠름 | 스키마 복잡도 · Free 제약 | 행 수 폭증 시 |
| **E. multi-DB COLD** | 회사/다른 프로젝트로 이전 | — | 합의 위반 · 동기화·비용 | **채택 안 함** |

## 대시보드 영향 (실행 시)

- LIVE latest 뷰: 최신만이면 **영향 없음**
- `farm_trend_history*`: 보존 창 &lt; 차트 최대 기간이면 **빈 버킷** → UX·문서에 기간 상한 명시 필요
- raw: RS/Edge 쓰기 전용 — 대시보드 SELECT 없음 · 삭제 시 재처리/디버그 제약만

## 승인 전 체크리스트

- [ ] 옵션(B/C/D) 선택과 보존 일수
- [ ] dry-run: 삭제/이동 대상 행 수·디스크 추정
- [ ] 스테이징에서 job 1회 · trend 24h/30d 스모크
- [ ] 롤백: job 비활성 · archive면 복원 절차
- [ ] 사용자 명시 승인 (migration / cron / 운영 설정)

## 현재 상태

| 항목 | 상태 |
| --- | --- |
| 설계 문서 | **본 문서** + [`DECODED_ROWCOUNT_PLAN.md`](./DECODED_ROWCOUNT_PLAN.md) |
| **합의(2026-08-05)** | decoded HOT=**30일** · 차트·보관 상한=**30일** · 희소 추천안 채택 · 초과분 detach→archive |
| SQL / cron / migration | **미작성 · 미적용** (승인 후) |
| cmd-poll ids 배칭 | 백로그 (현행 조건부 폴링 유지) |

관련: [`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md) · [`PERF_BASELINE.md`](./PERF_BASELINE.md) · [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md)
