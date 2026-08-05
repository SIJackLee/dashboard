# decoded 행 수 계획 — 상세 계획

> **대상:** `iot_room_state_decoded` (+ raw는 후속 별도)  
> **전략:** ① 파티션 HOT 경량화 → ② 희소 쓰기(추천안) → ③ 30일 초과 retention  
> **합의 확정:** 2026-08-05 (아래 §합의)  
> **실행 상태 (2026-08-05):**  
> ① D1 파티션 **운영 적용** (월 RANGE · legacy 보관)  
> ② 희소 PoC **적용** — `iot_decoded_last_value` + config + `decode-batch`  
> ③ raw=decoded **30일** 합의 + retention **초안** — DELETE/cron 미적용

실측(2026-08-05): ~8.8k행 · 34MB(indexes 74%) · 컨트롤러 간격 ≈ **5분** · 일 ~1.4k행.

관련: [`DECODED_CAPACITY.md`](./DECODED_CAPACITY.md) · [`IOT_RETENTION_OPTIONS.md`](./IOT_RETENTION_OPTIONS.md)

---

## 합의 (잠금)

| 항목 | 결정 |
|------|------|
| **HOT** | **현재로부터 30일** 로그 (차트·LIVE가 보는 전 구간) |
| **희소** | **추천안 채택** — Edge decode만 희소 · raw 유지 · 절대값+heartbeat · Δ 금지 |
| **차트·보관 상한** | **30일** — 초과분 detach/archive(또는 승인된 DELETE) |

함의: HOT 창 = 보관 상한 = 30일 → **WARM 티어 없음**.  
보관 창 안은 전부 HOT 인덱스 · **30일 초과만** COLD(detach).

---

## 0. 목표·비목표

| 목표 | 비목표 |
|------|--------|
| 30일 창 안 LIVE/trend 성능·운영 비용 통제 | multi-DB COLD |
| 희소로 **일 행 증가율** 억제 | 순수 Δ 체인 |
| 30일 초과 안전 폐기 | 승인 없는 DELETE |
| latest / trend RPC / list flat 계약 유지 | View로 저장 위장 |

---

## 1단계 — 파티션 (D1)

### 1.1 키·단위

- `PARTITION BY RANGE (mesure_at)` · **월 단위** 파티션  
- Free tier: 동시에 살아 있는 파티션 ≈ **당월 + 전월**(≤30일이면 최대 2~3개) + 익월 예비

### 1.2 티어 (확정안)

| 티어 | 정의 | 인덱스 | 읽기 |
|------|------|--------|------|
| **HOT** | `mesure_at >= now() - 30 days` 인 월 파티션들 | 현행 5종 동등 | LIVE + trend 전체(≤30d) |
| **COLD** | 30일 밖 월 파티션 | detach → archive(동일 스키마) 또는 승인 후 DROP | 기본 앱 경로 **제외** |

월 경계: “정확히 30일”은 job이 **일 단위로 detach 후보 판정**(파티션 전체가 30일보다 오래되면 detach).

### 1.3 전환 절차 (승인 후)

1. 파티션 부모 테이블 생성 + 월 파티션  
2. 데이터 복사 · 인덱스·트리거(`fill_keys`, `mesure_at`)·RLS 재부착  
3. `raw_id` UNIQUE/FK 전략 확정(버전 제약 검토)  
4. 뷰/RPC는 **부모** 조회(30일 필터는 RPC·앱 기존 기간과 일치)  
5. rename 스왑 · Edge upsert 검증  
6. `_legacy` 안정화 후 DROP(별도 승인)

### 1.4 완료 기준

- [ ] LIVE·trend(≤30d) 스모크  
- [ ] upsert failed=0  
- [ ] HOT 파티션만 autovacuum 부담

---

## 2단계 — 희소 쓰기 (D3 · 추천안 확정)

### 2.1 정책

```
series = (lsind, item, module_uid, controller_key)
last = 직전 **decoded에 저장한** 절대값
if |temp-last.temp| > ε_temp
   OR |fan_ex-last.fan_ex| > ε_fan OR |fan_in-last.fan_in| > ε_fan
   OR now - last_t >= heartbeat:
    UPSERT decoded (absolute)
    update last
else:
    skip decoded   # raw INSERT는 그대로
```

| 파라미터 | **확정 초깃값(추천)** | 조정 |
|----------|----------------------|------|
| ε_temp | **0.2 °C** | PoC 후 ±0.1 |
| ε_fan | **2 %p** | PoC 후 1~3 |
| heartbeat | **30분** | 5분×6 업링크마다 최소 1행 |
| 위치 | **decode-batch (Edge)** | RS에서 필터 금지 |
| last 저장 | 테이블 `iot_decoded_last_value` (또는 동등) | Redis 선택 |

`fan_supply`는 현재 미기록 → 비교에서 제외(exhaust/intake·temp만).

### 2.2 차트

- LIVE: 최신 absolute → 변화 없음  
- trend: PoC에서 **LOCF 후 버킷 avg** vs 현행 관측평균 오차 측정 후 문서화  
- 차트 UI 최대 기간 **30일**과 동일

### 2.3 롤아웃

1. ~~last 테이블 + config~~ → migration `20260805150000_iot_decoded_sparse_poc.sql` 적용  
2. ~~Edge decode-batch 희소 게이트~~ → 배포 v14 · allowlist `FARM01/P00` · ε_temp=0.2 · ε_fan=2 · heartbeat=1800s  
3. **관측 중** — 3~7일 행/일·trend 오차 기록  
4. 전 농장 확대 (`sparse_farm_keys` 비우면 전체)  
5. 플래그 기본 on 유지 / 장애 시 `sparse_enabled=false`

스모크(2026-08-05): 동일 raw 재처리 시 `sparse_skipped>0` · `last_value` 갱신 확인.  
skip 시에도 decode cursor는 전진(raw 보존 · 재디코드는 cursor rewind로 가능).

### 2.4 완료 기준

- [x] raw 행 수 불변(희소는 decoded만 skip)  
- [ ] PoC 행/일 감소율 기록  
- [ ] trend 30d UX 허용

---

## 3단계 — Retention (D4 · 30일)

### 3.1 정책

- decoded: **`mesure_at` 기준 30일 초과** 월 파티션 → **detach → archive**(동일 컬럼)  
- 즉시 DROP 금지(1차). archive 보관 기간·폐기는 추후  
- raw: **확정 30일** (`received_at`) — decoded와 동일. 초안만 작성, DELETE/cron은 승인 후  
- dry-run(2026-08-05): decoded·raw 모두 **30일 초과 0행** (창 안 데이터만 존재)

### 3.2 Job

- 일 1회: “완전히 30일보다 오래된 월 파티션” detach  
- dry-run 로그 필수 · 명시 승인 후 cron

### 3.3 승인 체크리스트

- [ ] dry-run 행 수  
- [ ] trend 30d 스모크(경계일)  
- [ ] re-attach 롤백 절차  
- [ ] **명시 승인**

---

## 4. 확정 로드맵

```text
합의 잠금 (본 문서)
    │
    ├─① D1 파티션 SQL 초안 → 승인 → 전환
    │
    ├─② 희소: last 테이블 + Edge 플래그 → FARM01 PoC → 전체
    │
    └─③ 30d detach→archive job (D1 이후) → 승인 후 cron
```

권장 순서: **① 파티션 → ② 희소 PoC → ③ retention job**.  
(희소를 파티션보다 먼저 해도 되나, retention/detach는 파티션이 있어야 안전.)

---

## 5. 다음 실행 게이트

| # | 항목 | 상태 |
|---|------|------|
| 1 | D1 파티션 SQL 초안 | ✅ **운영 적용** (2026-08-05) · legacy 테이블 보관 |
| 2 | 희소 PoC | ✅ DB+Edge · 관측 기간 진행 |
| 3 | raw 30일 + retention 초안 | ✅ 합의·초안 · ❌ DELETE/cron |

D1 적용 메모: `UNIQUE(raw_id,mesure_at)` · Edge upsert 동일 · `mesure_at`은 Edge가 전송(파티션 이동 트리거 제거) · 롤백은 `iot_room_state_decoded_legacy` rename 스왑.
