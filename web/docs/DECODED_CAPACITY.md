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
| **D1** | 시간 파티션 / HOT·archive (동일 스키마) | 운영 힙·인덱스 유지비↓ | **설계 대기(승인 후)** |
| **D2** | HOT flat 유지 · WARM/COLD json 정본 | 장기 heap↓ | 설계 |
| **D3** | series_id / 희소 절대값 | 확장 시 | 후순위 |
| **D4** | retention DELETE | 행·인덱스↓ | `IOT_RETENTION_OPTIONS` · 별도 승인 |

Δ 체인 저장은 제외.

---

## 4. D1 스케치 (미적용)

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
