# Phase C — DELIN 기상 권장 말풍선 (상세 · 적용)

> **상위:** [`weather-ctrl-recommendation-p1.md`](./weather-ctrl-recommendation-p1.md) §6·§9  
> **선행:** Phase A ✅ · Phase B ✅  
> **상태:** **구현 완료** (2026-08-11) · `[적용]` → Phase D  
> **PoC:** FARM01/P00 · proactive 말풍선 · `[적용]` UI placeholder (Phase D)

---

## 1. 목적 · Phase C 경계

| Phase C **포함** | Phase C **미포함** |
|------------------|-------------------|
| `unpack-recommendation` UNPACK 템플릿 | LIVE 재검증 · 명령 전송 |
| `delin-weather-nudge-bubble` UI | `approved` · command_id |
| SSR pending + 60s poll | OpenAI |
| `POST /api/weather-control/dismiss` | `WEATHER_CTRL_REC_V1` Production gate (Phase E) |
| DELIN 탭 앵커 (비-aria 탭) | |

**Done (Phase C):**

- [x] UNPACK 3규칙 + 단위 테스트
- [x] dismiss RPC + API
- [x] 말풍선 컴포넌트 (적용 disabled · 무시 동작)
- [x] `/farm` SSR → `FarmPageContent` bubble
- [x] pending poll 60s
- [x] 투어 active / aria 탭 / stale 시 미표시

---

## 2. 구현 파일

| 경로 | 역할 |
|------|------|
| `src/lib/weather-control/unpack-recommendation.ts` | 한국어 UNPACK |
| `src/lib/weather-control/weather-nudge-view.ts` | client-safe 타입 |
| `src/lib/weather-control/weather-ctrl-enabled.ts` | `WEATHER_CTRL_REC_V1` gate |
| `src/lib/weather-control/use-weather-nudge-poll.ts` | 클라이언트 poll |
| `src/components/farm/delin-weather-nudge-bubble.tsx` | 말풍선 UI |
| `src/lib/data/weather-recommendation.ts` | SSR read + dismiss |
| `src/app/api/weather-control/dismiss/route.ts` | POST dismiss |
| `supabase/migrations/20260812140000_weather_control_dismiss_rpc.sql` | RPC |

---

## 3. 표시 조건

```
WEATHER_CTRL_REC_V1 enabled
&& delinEnabled()
&& !tourActive
&& view !== 'aria'
&& pending && !stale
```

---

## 4. 검수

```bash
npx tsx src/lib/weather-control/unpack-recommendation.test.ts
npx tsx scripts/smoke-weather-control-eval.ts --farm=FARM01/P00 --invoke
# pending row 있을 때 /farm map 탭 — DELIN 탭 아래 말풍선
```

---

## 5. Phase D handoff

- ~~`[적용]` → `POST /api/weather-control/approve`~~ ✅ [`weather-ctrl-phase-d.md`](./weather-ctrl-phase-d.md)
