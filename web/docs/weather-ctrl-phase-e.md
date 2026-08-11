# Phase E — 출시 gate · smoke · ship

> **상위:** [`weather-ctrl-recommendation-p1.md`](./weather-ctrl-recommendation-p1.md) §9 Phase E  
> **선행:** Phase A~D ✅  
> **상태:** **구현 완료** (2026-08-11)

---

## 1. 목적

| Phase E **포함** | Phase E **미포함** |
|------------------|-------------------|
| `WEATHER_CTRL_REC_V1` Production gate | v2 자동 적용·일괄 농장 |
| API gate (pending/dismiss/approve) | OpenAI proactive |
| ship smoke 스크립트 | DB `weather_control_config` admin UI |

---

## 2. Feature flag — `WEATHER_CTRL_REC_V1`

`src/lib/weather-control/weather-ctrl-enabled.ts` (델린 gate와 동일 패턴)

| 환경 | 기본 |
|------|------|
| **Production** | **off** — Vercel env `WEATHER_CTRL_REC_V1=true` 로 명시 on |
| Preview | on |
| local `development` | on |
| `false`/`0`/`off` | 강제 off |
| `true`/`1`/`on` | 강제 on |

**연동:**

- SSR `/farm` — `weatherNudgeEnabled`
- `GET/POST /api/weather-control/*` — `assertWeatherCtrlRecEnabled()` → 404 `feature_disabled`

**백엔드 evaluate** (Edge cron)는 **`weather_control_config.enabled`** 별도 — UI off여도 snapshot·pending 생성은 DB config 따름.

---

## 3. Vercel 배포 (Production on 절차)

1. Preview에서 `npm run smoke:weather-control` PASS  
2. (선택) `node scripts/smoke-weather-control-ship.mjs --ui`  
3. Production env: `WEATHER_CTRL_REC_V1=true` (**명시 승인 후**)  
4. FARM01 PoC: `weather_control_config.enabled=true` 유지  
5. DELIN 탭: Preview/Prod에서 `NEXT_PUBLIC_DELIN_ENABLED` 또는 preview 기본 on

---

## 4. Smoke

```bash
cd dashboard/web

# unit + backend (Supabase service role)
npm run smoke:weather-control

# + Playwright UI (dev 서버 필요)
npm run smoke:weather-control:ui

# 전체 ship (UI 제외)
node scripts/smoke-weather-control-ship.mjs

# 전체 ship + UI
node scripts/smoke-weather-control-ship.mjs --ui
```

---

## 5. P1 Done (검수 체크)

| 항목 | 상태 |
|------|------|
| FARM01 KMA snapshot | ✅ Phase A |
| pending 30m TTL | ✅ Phase B |
| DELIN 탭 말풍선 | ✅ Phase C |
| UNPACK (OpenAI 없음) | ✅ Phase C |
| [적용] → command pending | ✅ Phase D |
| [무시]/만료 미표시 | ✅ C+D |
| Production gate | ✅ Phase E |

**ACK → applied** 확인은 현장 디바이스·기존 command pipeline UI로 수동 검수.

---

## 6. 파일

| 경로 | 역할 |
|------|------|
| `src/lib/weather-control/weather-ctrl-enabled.ts` | env gate |
| `src/lib/weather-control/weather-ctrl-api-gate.ts` | API 404 |
| `scripts/smoke-weather-control-ship.mjs` | ship runner |
| `scripts/smoke-weather-control-ui.mjs` | Playwright UI |

---

## 7. 롤백

1. Vercel `WEATHER_CTRL_REC_V1=false` 또는 env 삭제 → Production UI/API off  
2. `UPDATE weather_control_config SET enabled=false` — pending 생성 중단  
3. Edge evaluate hook은 config off 시 skip (Phase B)
