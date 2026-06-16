# Dashboard 배포 — RS-DB-C (Vercel)

> **EC2 Cloud Agent 범위 밖** — Vercel이 `main` push 시 자동 배포.  
> EC2(RS+C): `https://github.com/SIJackLee/rsd` → `CLOUD_DEPLOY.md`

---

## RS-DB-C에서 dashboard 역할

| Before | After |
|--------|-------|
| `iot_room_state_decoded` (D.py INSERT) | `v_iot_raw_live` → TS decode |
| burst merge | `iot-raw-live.ts` — controllerKey별 최신 row |

EC2는 `RS.py`만 raw INSERT. decode·LIVE UI는 **이 앱** (`web/src/lib/data/*`).

---

## Supabase migration (1회, 별도)

```
web/supabase/migrations/20260614000000_rs_live_views.sql
```

```sql
SELECT count(*) FROM public.v_iot_raw_live;
```

---

## Vercel (자동 배포)

| 설정 | 값 |
|------|-----|
| Repo | `github.com/SIJackLee/dashboard` |
| Branch | `main` |
| Root Directory | `web` |

`main` push → Vercel build. 수동 Redeploy는 장애 시에만.

로컬 검증:

```bash
cd web
npm ci && npm run build && npm run lint
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-14 | RS-DB-C raw LIVE 조회 |
| 2026-06-14 | Cloud Agent 지침 제거 (EC2 전용으로 분리) |
