/** D9 — admin global live query cap (health count hint; farm-scoped reads use LIVE_FARM_ROW_LIMIT) */
export const GLOBAL_LIVE_ROW_LIMIT = 1500;

/** Per-farm LIVE list query cap (aligns with PostgREST max_rows=1000 headroom) */
export const LIVE_FARM_ROW_LIMIT = 500;

/** Edge decode backlog — raw rows not yet past cursor */
export const DECODE_LAG_WARN = 100;

export const DECODE_LAG_CRITICAL = 500;

export const UPLINK_ROUND_SEC = 300;

export const HEALTH_REVALIDATE_SEC = 300;

export const INSERT_BUCKET_COUNT = 7;

export const INSERT_BUCKET_MINUTES = 5;

/** Bar chart reference lines (minutes) */
export const MODULE_AGE_OK_MIN = 5;

export const MODULE_AGE_CRITICAL_MIN = 15;
