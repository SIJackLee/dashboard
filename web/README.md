# 스마트 축사 IoT 대시보드

IoT 축사 환경 제어 시스템의 모니터링·제어 대시보드. Supabase **Edge decode** 결과를 **List/Detail tier**로 권한별 조회하고, 컨트롤러에 제어 명령을 발행한다.

> **RS-DB-C:** LIVE 목록 `v_iot_dashboard_list`, 상세 `v_iot_decoded_latest`, Admin 지도 `v_iot_farm_overview`. Health insert rate는 `iot_room_state_raw` 직접 조회.  
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
npm run verify:mobile-interaction
npm run verify:routes
```

## 환경변수 (`.env.local`)

`.env.example`에 이름만 기록되어 있다. 실제 값은 커밋하지 않는다.

| 이름 | 용도 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (RLS 전제) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (서버 전용, 관리자 기능) |
| `NEXT_PUBLIC_LIVE_READ_TIER` | (선택) `list`(기본) \| `legacy` — 목록 tier 롤백 |

## LIVE read path (perf)

- **List:** `v_iot_dashboard_list` — flat env + fan + channel-A thermo (setpoint band), no `decoded_json` payload
- **Overview:** `v_iot_farm_overview` — admin `/farm` aggregate
- **Detail:** `GET /api/live/controller` — 1 ctrl + channels/thermo
- **Cache:** 300s `unstable_cache` + `revalidateTag('live')` on thermo save
- **Baseline:** `npm run measure:live` · [`docs/PERF_BASELINE.md`](docs/PERF_BASELINE.md)

## 인증 / 권한

- 이메일/비밀번호 로그인 (Supabase Auth). `/` 접속 시 `/login`으로 이동.
- 권한은 DB의 RLS로 강제(`user_can_read_farm`, `is_admin` 등). 앱은 `lib/auth/get-current-user.ts`로 user+profile+access를 조합.
- 데이터 접근 권한이 없으면 `/pending`, 관리자만 `/admin/users`, `/admin/health`(시스템 상태), `/admin/health/farm/[key]`(농장 drill-down), `/admin/health/group/[groupId]`(수집 그룹 R3) 접근.

## 디렉터리 개요

- `src/app/(dashboard)/*` — 농장/축사/컨트롤러/관리자 등 페이지 (인증 게이트 적용)
- `src/components/*` — `layout` / `common` / 도메인별(farm, controllers, admin)
- `src/lib/data/iot.ts` — LIVE types + `getLiveReadings(scope)`
- `src/lib/data/iot-live-fetch.ts` — list/detail/overview fetch + cache
- `src/lib/data/live-config.ts` — tier flag, cache TTL, farm row limit
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

## UI 개선 Phase 1 (적용됨)

- **TopBar KPI:** `GlobalContextStrip` — 농장·컨트롤러·오프라인·알람 4칸만 (온습 제거). Admin 전국 `/farm` 지도는 KPI 숨김.
- **로그아웃:** 사이드바 account block만 (TopBar 중복 제거).
- **`/farm` 본문:** 지도·목록 탭(`FarmPageContent` → `FarmMapView`). 최근 활동은 계정 메뉴 `RecentActivityMenuSection`.
- **알람 필터 칩:** 라벨만 표시 (건수는 `aria-label`).
- **컨트롤러 목록:** `EnvChip` 온·습 추가 (패널과 동일 컴포넌트).
- **Admin 배지:** `FarmStatusBadge` → 공통 `StatusBadge` + `lib/ui/status-tone.ts`.
- **Admin nav:** `nav-items.ts`의 `adminNavItems`.

## UI 개선 Phase 2 (적용됨)

- **ScopeBar:** `components/layout/scope-bar.tsx` — farm · SP · stall · Refresh 통합. TopBar `FarmSwitcher` 제거 → `/controllers`·`/alarms` ScopeBar.
- **Sticky:** `/controllers`·Admin `/alarms` ScopeBar 상단 고정.
- **MasterDetailLayout:** alarms 2열 공통화 (Phase 4에서 `OpsTriageView`로 흡수, 컴포넌트 제거됨).
- **O2 triage:** `AlarmTriagePanel` — 상세 + embedded `ControllerPanelFace` (1-screen Act).
- **O2bell:** TopBar bell 항목 → `alarmControlHref()` → `/controllers?ctrl=…` deep link.
- **알람 행 선택:** `router.replace` 클라이언트 선택 (페이지 전환 없음).

## UI 개선 Phase 3 (적용됨)

- **`FarmDashboardShell`:** `mapMode=geo|grid` — Admin 전국 지도 vs Operator/Admin scoped 그리드 단일 shell.
- **Admin scoped `/farm`:** `stripAdminFarmDrillDown` 리다이렉트 제거 → ScopeBar(농장 선택) + Operator와 동일 그리드.
- **A1 합류:** Admin scoped 이후 `/controllers`·`/alarms`와 동일 ScopeBar·URL 규칙.

다음 단계: Phase 4 — Monitoring 3탭 IA (선택).

## UI 개선 Phase 4 (적용됨, 이후 2탭으로 축소)

- **Monitoring 허브:** `/farm` + `?tab=map|ops` — 현황(map) · 컨트롤러·알람·설정(ops) 단일 허브.
- **`OpsTriageView`:** `tab=ops`에서 3열 트리아지(농장·축사·컨트롤러·알람·설정 패널).
- **`MonitoringTabs`:** 탭 전환 시 `lsind`·`ctrl`·`alarm` 등 scope query 유지.
- **사이드바:** 농장·컨트롤러·알람 3항목 → **모니터링** 1항목 (+ 설정 · Admin 운영).
- **레거시 URL:** `/controllers`·`/alarms` → `/farm?tab=ops` redirect; `tab=devices|alarms` query도 `ops`로 정리.
- **href helpers:** `buildControllerHref`·`buildFarmAlarmsHref`·`alarmTargetHref` → `/farm?tab=ops…`.

## UI 개선 Phase 5 (적용됨)

- **A2 health:** `HealthSectionCard` — health 전역 `SectionCard(lg)` 통일 (overview · drill-down · node detail).
- **운영 KPI 분리:** health 메타 문구에서 경로 표기 정리, TopBar KPI 혼합 없음 유지.

## UI 개선 Phase 6 (적용됨)

- **Admin Ops 허브:** `/admin/ops` + `?tab=system|users|farms` — 시스템 · 사용자 · 농장 메타 3탭.
- **사이드바:** 시스템 상태·사용자 관리 → **운영** 1항목.
- **레거시:** `/admin/health`·`/admin/users` → `/admin/ops?tab=…` redirect. health drill-down 경로 유지.
- **설정:** Admin `farm` 탭 → 운영 **농장 메타** 탭으로 이전.

## 더 보기

전체 작업 맥락·데이터 구조·의사결정은 [`../docs/PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md) 참고.
