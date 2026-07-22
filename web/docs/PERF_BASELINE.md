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

- Bucket policy: 24h = 15 min (96 pts), 7d = 6 h (28), 30d = 1 d (30) — see [`docs/changes/farm-trend-cache-policy.md`](../../docs/changes/farm-trend-cache-policy.md)
- Map tab SSR skips controller-trend fetch (P4 lazy load)
- Admin ops Z3 (`FarmScopedPanel`) uses per-farm scoped fetch + SSR trend via server action when `tab=ops` and farm selected

## Soft refresh tiers (H2)

| Mode | Action | Loads | Used by |
| --- | --- | --- | --- |
| `live` (default) | `fetchFarmScopedLiveDataAction` | LIVE readings + barn layout/map | ScopeBar / list soft refresh, ACK `onRefreshLive` |
| `full` | `fetchFarmScopedPanelDataAction` | LIVE + alarm + thermo/history + map trend | cold bootstrap / enrich / `revalidateFarmLive({ mode: "full" })` |
| controller trend | `fetchFarmControllerTrendAllPeriodsAction` | list graph controller trend | list trend refresh bar |

Soft refresh no longer reloads settings or trend in the same round-trip as LIVE.
