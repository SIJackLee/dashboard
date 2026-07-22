# LIVE read performance baseline

Phase 0 측정 기록. local dev · Supabase remote DB 기준.

## 측정 방법

```bash
cd dashboard/web
npx tsx scripts/measure-live-read.ts
```

페이지 TTFB는 브라우저 DevTools Network 탭에서 `/farm`, `/controllers`, `/alarms`, `/settings`, `/admin/ops` 각 10회 샘플.

## 목표 (local dev, post-optimization)

| 지표 | 목표 |
| --- | --- |
| LIVE SELECT p95 | &lt; 300 ms |
| 페이지 TTFB p95 | &lt; 1.5 s |

## Baseline (pre-optimization)

| Query | p50 (ms) | p95 (ms) | Notes |
| --- | --- | --- | --- |
| `v_iot_decoded_latest` limit 1500 + `decoded_json` | _run script_ | _run script_ | legacy path |
| `v_iot_dashboard_list` limit 500 | _run script_ | _run script_ | list tier |
| `v_iot_farm_overview` | _run script_ | _run script_ | admin /farm |

## Post-optimization

| Query | p50 (ms) | p95 (ms) | Phase |
| --- | --- | --- | --- |
| List farm-scoped 500 | | | 1-A |
| Detail 1 row | | | 1-B |
| Farm overview | | | 1-C |
| Cached repeat navigation | | | 1-D |

## 정책

- 서버 캐시: `unstable_cache` 300 s + `revalidateTag('live')` on thermo save
- `NEXT_PUBLIC_LIVE_READ_TIER=list` (rollback: `legacy`)
- farm-scoped limit: `LIVE_FARM_ROW_LIMIT=500`
- PostgREST `max_rows=1000` 유지 ([`supabase/config.toml`](../supabase/config.toml))

## Trend RPC (farm `/farm`)

| RPC | When loaded | Cache tag | Typical rows (24h) |
| --- | --- | --- | --- |
| `farm_trend_history` | SSR (grid + page + hub scoped Z3) | `live:trend:{scope}` | SP × stall × 96 buckets |
| `farm_trend_history_by_controller` | Client lazy (list graph) | `live:controller-trend:{scope}` | SP × stall × controller × 96 buckets |

- Bucket policy (source → display via `binWorst` / avg downsample): 24h = 15 min × 96 → 24, 7d = 1 h × 168 → 28, 30d = 1 h × 720 → 30 (`farm-trend-types.ts` + `GRAPH_BARS`)
- Map tab SSR skips controller-trend fetch (P4 lazy load)
- Admin ops Z3 (`FarmScopedPanel`) uses per-farm scoped fetch + SSR trend via server action when `tab=ops` and farm selected

## Soft refresh tiers (H2)

| Mode | Action | Loads | Used by |
| --- | --- | --- | --- |
| `live` (default) | `fetchFarmScopedLiveDataAction` | LIVE readings + barn layout/map | ScopeBar / list soft refresh, ACK `onRefreshLive` |
| `full` | `fetchFarmScopedPanelDataAction` | LIVE + alarm + thermo/history + map trend | cold bootstrap / enrich / `revalidateFarmLive({ mode: "full" })` |
| controller trend | `fetchFarmControllerTrendAllPeriodsAction` | list graph controller trend | list trend refresh bar |

Soft refresh no longer reloads settings or trend in the same round-trip as LIVE.

## Follow-ups (M1–M5 / L1–L2)

| Item | Change | Status |
| --- | --- | --- |
| M1 | `startTransition` URL only; controller-trend module cache shared map/list | done |
| M4 | Admin hub SSR first batch → client TailLoader hydrate (LIVE SSR 제거) | done |
| M5 | Ops `fetchHealthSnapshotAction` patch (no periodic `router.refresh`) | **done** (2026-07-22) |
| L1 | `staggerMount` only when `readings.length > STAGGER_MOUNT_MIN_READINGS` (8) | **done** (2026-07-22) |
| L2 | `FarmMapCanvas` / `FarmMapMobileStage` / `FarmMapBulkApply` via `next/dynamic` | **done** (2026-07-22) |

## Admin hub TTFB

| Change | Effect |
| --- | --- |
| `fetchFarmOverviewForFarmKeys` | N per-farm queries → **1 OR batch** + `unstable_cache` 60s |
| `cachedLiveQuery` | broken `shouldCache`(always DB) → real `unstable_cache` hit |
| Admin login warm | `signInWithEmail`이 overview 캐시를 미리 채움 → 직후 `/farm` cold≈warm |
| Hub grid SSR | 첫 배치 LIVE SSR 제거 → `TailLoader`가 전부 client hydrate |

### Measured (dev, 2026-07-22)

Playwright `node scripts/measure-hub-ttfb.mjs` — `/farm` navigation, `responseStart` ≈ TTFB. n=3.

| Scenario | wall median | TTFB (`responseStart`) median | Notes |
| --- | --- | --- | --- |
| **warm** (login overview warm) | **287 ms** | **106 ms** | Steady after login |
| **cache-cleared** (`.next/dev/cache` 삭제, 동일 프로세스) | **260 ms** | **98 ms** | Disk만 비움 — in-memory `unstable_cache`는 유지될 수 있음 |
| **strict-cold** (`SKIP_ADMIN_HUB_WARM=1` + restart 후 login) | **276 ms** (first **1920 ms**) | **107 ms** (first **170 ms**) | Warm 없이 overview를 `/farm`에서 조회. 첫 히트에 compile 포함 |
| Prior (LIVE SSR hub batch) | ~2.4 s | — | 개선 전 cold 체감 |

재측정:

```bash
# warm + disk cache clear
npm run measure:hub-ttfb

# true cold (warm skip): restart with env, then
# SKIP_ADMIN_HUB_WARM=1 npm run dev
# TTFB_PHASE=strict-only npm run measure:hub-ttfb
```
