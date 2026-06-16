# 스마트 축사 IoT 대시보드

IoT 축사 환경 제어 시스템의 모니터링·제어 대시보드. Supabase raw uplink를 **조회 시 decode**하여 권한별로 표시하고, 컨트롤러에 제어 명령을 발행한다.

> **RS-DB-C (2026-06-14~):** LIVE 데이터는 `v_iot_raw_live` + TS decode. `iot_room_state_decoded` 쓰기는 EC2에서 중단.  
> **Cloud Agent:** [CLOUD_DEPLOY.md](CLOUD_DEPLOY.md) · [../../docs/CLOUD_DEPLOY_RS-DB-C.md](../../docs/CLOUD_DEPLOY_RS-DB-C.md)

## 기술 스택

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (Auth + Postgres, `@supabase/ssr`)

## 시작하기

```bash
npm install
# .env.local 설정 (아래 환경변수 참고)
npm run dev      # http://localhost:3000
```

검증:

```bash
npm run build    # 타입체크 + 프로덕션 빌드
npm run lint
```

## 환경변수 (`.env.local`)

`.env.example`에 이름만 기록되어 있다. 실제 값은 커밋하지 않는다.

| 이름 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (RLS 전제) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (서버 전용, 관리자 기능) |

## 인증 / 권한

- 이메일/비밀번호 로그인 (Supabase Auth). `/` 접속 시 `/login`으로 이동.
- 권한은 DB의 RLS로 강제(`user_can_read_farm`, `is_admin` 등). 앱은 `lib/auth/get-current-user.ts`로 user+profile+access를 조합.
- 데이터 접근 권한이 없으면 `/pending`, 관리자만 `/admin/users` 접근.

## 디렉터리 개요

- `src/app/(dashboard)/*` — 농장/축사/컨트롤러/관리자 등 페이지 (인증 게이트 적용)
- `src/components/*` — `layout` / `common` / 도메인별(farm, barns, controllers, admin)
- `src/lib/data/iot.ts` — LIVE raw/View 조회 + decode (RS-DB-C)
- `src/lib/data/wire-decode-v0b.ts` — wire v0x0B decode
- `src/lib/data/iot-raw-live.ts` — controllerKey별 최신 merge
- `src/lib/supabase/*` — Supabase 클라이언트(client/server/admin/middleware)
- `src/proxy.ts` — Next 16 미들웨어(세션 갱신 + 라우트 보호)

## Vercel 배포

이 저장소는 Next.js 앱이 **`web/`** 폴더에 있다. Vercel 프로젝트에서 아래를 설정한다.

| 설정 | 값 |
| --- | --- |
| **Root Directory** | `web` |
| Framework Preset | Next.js (자동 감지) |
| Build Command | `npm run build` (기본값) |
| Output Directory | `.next` (기본값) |

**Environment Variables** (Production·Preview·Development 모두):

| 이름 | 형식 예시 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` (프로젝트 ref만 넣으면 안 됨) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → anon |
| `SUPABASE_SERVICE_ROLE_KEY` | 동일 화면 service_role (서버 전용) |

설정 후 **Redeploy**. 정상이면 `/` → `/login` 리다이렉트가 보인다. `404 NOT_FOUND`가 나오면 Root Directory가 `web`인지 먼저 확인한다.

## 더 보기

전체 작업 맥락·데이터 구조·의사결정은 [`../docs/PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md) 참고.
