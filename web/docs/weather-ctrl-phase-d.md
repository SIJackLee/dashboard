# Phase D — 승인 · 명령 · tracker 연동

> **상위:** [`weather-ctrl-recommendation-p1.md`](./weather-ctrl-recommendation-p1.md) §7  
> **선행:** Phase A~C ✅  
> **상태:** **구현·원격 RPC 적용 완료** (2026-08-11)

---

## 1. 목적 · Phase D 경계

| Phase D **포함** | Phase D **미포함** |
|------------------|-------------------|
| `POST /api/weather-control/approve` | Phase E ship gate |
| LIVE·외기 **15분** 재검증 | OpenAI |
| `sendThermoCommandAction` (SET_CTRL_THERMO) | bulk apply |
| recommendation → `approved` + `command_id` | |

**Done (Phase D):**

- [x] `canCommand` + farm scope (`canEditFarmScope`)
- [x] pending + 미만료 검증
- [x] 외기·LIVE age ≤ **15분**, 규칙·proposed 일치 재평가
- [x] `note=weather:{rule_id}:{rec_id}`
- [x] 말풍선 `[적용]` → approve API → LIVE patch + soft refresh
- [x] stale 실패 copy: 「조건이 바뀌어…」

---

## 2. 구현 파일

| 경로 | 역할 |
|------|------|
| `src/lib/weather-control/approve-weather-recommendation.ts` | 재검증 + command + mark approved |
| `src/app/api/weather-control/approve/route.ts` | POST approve |
| `supabase/migrations/20260812150000_weather_control_approve_rpc.sql` | `approve_weather_control_recommendation` RPC |
| `src/components/farm/delin-weather-nudge-bubble.tsx` | `[적용]` wiring |
| `src/components/farm/farm-page-content.tsx` | `patchThermoFromCommand` + `revalidateFarmLive` |

---

## 3. 승인 흐름

1. 말풍선 `[적용]` → `POST /api/weather-control/approve { id }`
2. 서버: pending row · weather snapshot · LIVE · `evaluateWeatherDraft` 재실행
3. proposed 일치 시 `sendThermoCommandAction`
4. RPC로 `status=approved`, `command_id` 연결
5. 클라이언트: `fetchThermoCommandAction` → `patchThermoFromCommand` → `revalidateFarmLive`

---

## 4. 검수

```bash
# pending row + canCommand 계정
# /farm → 말풍선 [적용] → ctrl_thermo_command pending 1건
# weather_control_recommendation status=approved
```

---

## 5. Phase E

- ~~`WEATHER_CTRL_REC_V1` Production gate · E2E smoke · ship checklist~~ ✅ [`weather-ctrl-phase-e.md`](./weather-ctrl-phase-e.md)
