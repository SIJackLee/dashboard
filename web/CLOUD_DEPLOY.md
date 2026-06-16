# Dashboard Cloud Deploy — RS-DB-C (Step 1 + 3)

> **Supabase migration + Vercel Cloud Agent 실행 지침**  
> **Git repo:** `https://github.com/SIJackLee/dashboard` (branch `main`)  
> **앱 경로:** `web/`

> **3단계 중 Step 1·3.** Step 2(EC2)는 `https://github.com/SIJackLee/rsd` → `CLOUD_DEPLOY.md`  
> 통합 프롬프트: repo 루트 [AGENTS.md](../AGENTS.md)

---

## RS-DB-C 데이터 조회 변경 (필독)

**2026-06-14부터 LIVE 데이터는 decoded 테이블 쓰기가 아니라 raw + View + TS decode입니다.**

| Before | After |
|--------|-------|
| `iot_room_state_decoded` 조회 (D.py가 INSERT) | `v_iot_raw_live` → TS decode (`wire-decode-v0b.ts`) |
| burst merge (`live_chunk_merge`) | `iot-raw-live.ts` — controllerKey별 최신 row |

EC2는 `RS.py`만 raw INSERT. decode는 **이 dashboard 앱**에서 수행 — **EC2만 배포하고 dashboard redeploy를 생략하면 LIVE가 RS-DB-C로 동작하지 않습니다.**

통합 지침: [AGENTS.md](../AGENTS.md) (3단계 전체)

---

## Cloud Agent 체크리스트

### 1. Supabase migration (Dashboard 배포 **전** 권장)

**파일:**

```
supabase/migrations/20260614000000_rs_live_views.sql
```

**작업:**

- [ ] 운영 Supabase에 migration 적용
- [ ] View `public.v_iot_raw_live` 생성 확인

**적용 방법 (택 1):**

```bash
# Supabase CLI (linked project)
supabase db push

# 또는 Dashboard → SQL Editor에 migration 파일 내용 붙여넣기 실행
```

**검증:**

```sql
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public' AND table_name = 'v_iot_raw_live';

SELECT count(*) FROM public.v_iot_raw_live;
```

**View 역할:** v0x0B raw row 필터. **full decode는 앱 레이어** (`wire-decode-v0b.ts`).

---

### 2. Dashboard 앱 배포

**RS-DB-C 관련 소스 (빌드에 포함):**

| 파일 | 역할 |
|------|------|
| `src/lib/data/wire-decode-v0b.ts` | wire v0x0B decode |
| `src/lib/data/iot-raw-live.ts` | controllerKey별 최신 pick |
| `src/lib/data/iot.ts` | LIVE fetch (View 우선, raw fallback) |
| `src/lib/data/iot-live.ts` | 모듈 LIVE 스냅샷 |
| `src/lib/data/latest-received.ts` | 마지막 수신 시각 |

**레거시 유지 (REPLAY·과거 decoded):** `iot-live-merge.ts` 등 — 삭제하지 않음.

**배포 전 검증:**

```bash
cd dashboard/web
npm ci
npm run build
npm run lint
```

---

### 3. Vercel 설정

| 설정 | 값 |
|------|-----|
| Root Directory | `web` (monorepo인 경우 dashboard 하위) |
| Build Command | `npm run build` |
| Framework | Next.js |

**Environment Variables** (Production):

| 이름 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon (RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 |

- [ ] migration 적용된 **동일 Supabase 프로젝트** URL/key 사용
- [ ] Redeploy 후 `/login` 접근 확인
- [ ] LIVE 농장/축사 화면에서 controller 데이터 표시 확인

---

## Fallback 동작

`v_iot_raw_live`가 없어도 `iot.ts`는 `iot_room_state_raw` direct query fallback이 있습니다.  
**운영에서는 migration 적용을 표준**으로 합니다.

---

## Cloud Agent 지시 템플릿 (Step 1 + 3)

```text
Repo: https://github.com/SIJackLee/dashboard (branch main)
Role: Step 1 (Supabase) + Step 3 (Vercel) of RS-DB-C rollout
Read first: AGENTS.md, web/CLOUD_DEPLOY.md
Prerequisite Step 2: https://github.com/SIJackLee/rsd (RS.py + C.py on EC2)

Tasks:
1. Apply web/supabase/migrations/20260614000000_rs_live_views.sql to production Supabase
2. Verify v_iot_raw_live exists
3. git pull origin main && cd web && npm ci && npm run build && npm run lint
4. Vercel Redeploy Production (Root Directory=web)
5. Smoke: /login → farm LIVE page (live data needs EC2 RS uplink)

Do NOT:
- Skip Vercel redeploy after EC2-only deploy
- Expect D.py / iot_room_state_decoded writes for new LIVE data
- Drop iot_room_state_decoded (legacy read-only OK)
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-06-14 | RS-DB-C dashboard + Supabase migration 배포 지침 |
