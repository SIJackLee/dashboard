# decoded 용량 트랙 (iot_room_state_decoded)

> **실측:** iot-cloud · 2026-08-05 (Sprint A/B/C 푸시 직후 MCP)  
> **원칙:** 인덱스 DROP·파티션·DELETE는 별도 승인. 본 문서는 실측·판단·다음 후보.

---

## 1. 용량 실측

| 항목 | 값 |
|------|-----|
| **total** | **34 MB** |
| heap | ~9.0 MB (26%) |
| **indexes** | **~25 MB (74%)** |
| toast | ~8 KB |
| rows | 8,789 |
| avg row | ~931 B |
| `decoded_json` avg | ~731 B (**행의 78.6%**) |
| dead tuples | 1 (autovacuum 정상) |

raw 비교: total ~21 MB (indexes ~81%).

관련: [`DECODED_JSON_SLIM.md`](./DECODED_JSON_SLIM.md) (channels 유지 · flat 중복 키 제거)

---

## 2. 인덱스 사용률 (DROP 후보 없음)

| index | size | idx_scan | 역할 |
|-------|------|----------|------|
| `idx_iot_decoded_live_latest` | 7.8 MB | **27,642** | LIVE latest (partial live+ok) |
| `idx_iot_decoded_farm_received` | 6.9 MB | **8,273** | 농장·수신 시각 |
| `idx_iot_decoded_mesure_at` | 6.8 MB | **13,838** | trend / mesure_at |
| `uq_iot_decoded_raw_id` | 2.1 MB | **570,347** | raw 1:1 · decode upsert |
| PK | 2.1 MB | 37 | identity |

**판단:** 전부 활성 사용. 용량 줄이려고 인덱스를 지우면 LIVE/trend/decode 회귀 위험 → **Phase D0에서 DROP 금지**.

마이그레이션에만 있고 클라우드에 **없는** 인덱스(`idx_iot_decoded_live_list_scope`, `idx_iot_decoded_farm_module`, `idx_iot_decoded_session`)는 지금 **추가하지 않음**(용량↑).

---

## 3. 트랙 단계

| ID | 내용 | 용량 효과 | 상태 |
|----|------|-----------|------|
| **D0** | 실측·사용률·본 문서 | — | **완료** |
| **D-slim A** | DROP `session_id`,`chunk_seq`,`lut_ver`,`crc_ok` | 스키마 정리 | **완료 (2026-08-05)** |
| **D-slim B+C** | topic→농장키 · `controller_key`→stall/eqpmn 트리거 | 중복 쓰기 제거(컬럼 유지) | **완료 (2026-08-05)** |
| **D1** | 시간 파티션 · HOT=**30일** | 운영 힙·인덱스 | 합의됨 · SQL 미작성 |
| **D3 희소** | Edge 절대값+heartbeat(ε_t=0.2, ε_f=2, hb=30m) | 행 증가율↓ | 합의됨 · PoC 미착수 |
| **D4 retention** | **30일** 초과 detach→archive | total 상한 | 합의됨 · job 미착수 |

### D-slim A 적용

- migration: `20260805140000_iot_decoded_drop_unused_slim_a.sql` · iot-cloud 적용됨
- `fan_supply_pct`는 RPC/list가 컬럼을 노출하므로 **미포함**(별도)

### D-slim B+C 적용

- migration: `20260805141000_iot_decoded_fill_keys_bc.sql`
- `trg_iot_decoded_fill_keys` BEFORE INSERT/UPDATE
- Edge는 당분간 기존처럼 flat도 넣어도 됨(덮어쓰기 없음 · 빈 값만 채움)
- **컬럼 DROP 없음** — list/인덱스 계약 유지. 이후 Edge 미전송·컬럼 DROP은 별도 승인

---

## 4. 행 수 · D(flat) 의논 메모 (미적용)

### 행 수 (시계열 과다)

| 옵션 | 요지 | 장점 | 리스크 |
|------|------|------|--------|
| **희소 절대값** | ε/heartbeat일 때만 INSERT | 행·인덱스↓ 큼 | Edge 게이트 · 차트 버킷 의미 QA |
| **파티션 D1** | HOT만 인덱스 유지 | 운영 VACUUM↓ · 삭제 없이도 분리 | 마이그레이션 잠금 |
| **retention D4** | N일 후 DELETE/archive | total 직접↓ | 승인·복구 정책 |

권장 묶음: **파티션(HOT 경량) + 희소(쓰기↓)** · retention은 데이터 수명 합의 후.

### D — flat ↔ json

| 구간 | flat `temp`/`fan_*` | `decoded_json` |
|------|---------------------|----------------|
| HOT (최근 N일) | 유지 (list/trend 속도) | 유지 (패널) |
| WARM/COLD | 물리 생략 또는 NULL | 정본 · RPC 추출 |

주의: `fan_exhaust`/`fan_intake`·`temp_c`는 **현재 사용 중**. `fan_supply`만 비어 있음 → supply DROP/RPC 정리는 D와 별도 소작업 가능.

---

## 5. D1 스케치 (미적용)

- `mesure_at` RANGE 파티션(월 단위 권장)
- LIVE·latest는 HOT만 스캔
- trend RPC는 `*_all` 뷰
- detach ≠ DELETE

적용 전: 잠금·다운타임·Free tier 파티션 수 검토 후 **명시 승인**.

---

## 5. 관련

- [`RAW_STORAGE_CHANGE.md`](./RAW_STORAGE_CHANGE.md) — raw Phase 1~4
- [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)
- [`LIVE_HOT_VIEW_RULES.md`](./LIVE_HOT_VIEW_RULES.md)
- canvas: decoded-compression-options (현황→적용)
