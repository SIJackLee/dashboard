# Cloud Agent — Dashboard (RS-DB-C Step 1 + 3)

> **이 repo는 RS-DB-C 배포의 Step 1(Supabase) + Step 3(Vercel) 담당**  
> Step 2(EC2)는 별도 repo: `https://github.com/SIJackLee/rsd`

## 통합 프롬프트 (3단계 전체 — Cloud Agent에 이걸 전달)

```text
Apply RS-DB-C in order: Supabase → EC2 → dashboard redeploy.

Step 1 — Supabase (THIS repo)
  Repo: https://github.com/SIJackLee/dashboard  branch main
  File: web/supabase/migrations/20260614000000_rs_live_views.sql
  Project: iot-cloud
  Verify: SELECT count(*) FROM public.v_iot_raw_live;

Step 2 — EC2 (rsd repo)
  Repo: https://github.com/SIJackLee/rsd  branch main
  Stop R/S/D; start RS.py + C.py
  See: CLOUD_DEPLOY.md in rsd repo

Step 3 — Dashboard redeploy (THIS repo)  ← 필수
  git pull origin main
  cd web && npm ci && npm run build && npm run lint
  Vercel: Root Directory=web, Redeploy Production
  Smoke: /login → farm LIVE page

Do NOT deploy only EC2 and skip this step — LIVE decode is in web/src/lib/data/*.ts
```

## 상세 지침

[web/CLOUD_DEPLOY.md](web/CLOUD_DEPLOY.md)

## Vercel

| 설정 | 값 |
|------|-----|
| Git | `github.com/SIJackLee/dashboard` |
| Branch | `main` |
| Root Directory | `web` |
