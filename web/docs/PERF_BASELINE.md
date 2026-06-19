# LIVE read performance baseline

Phase 0 측정 기록. local dev · Supabase remote DB 기준.

## 측정 방법

```bash
cd dashboard/web
npx tsx scripts/measure-live-read.ts
```

페이지 TTFB는 브라우저 DevTools Network 탭에서 `/farm`, `/controllers`, `/alarms`, `/settings`, `/admin/health` 각 10회 샘플.

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
