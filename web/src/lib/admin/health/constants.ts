/** D9 — admin global live query cap (health count hint; farm-scoped reads use LIVE_FARM_ROW_LIMIT) */
export const GLOBAL_LIVE_ROW_LIMIT = 1500;

/** Per-farm LIVE list query cap (aligns with PostgREST max_rows=1000 headroom) */
export const LIVE_FARM_ROW_LIMIT = 500;

/** Edge decode backlog — raw rows not yet past cursor */
export const DECODE_LAG_WARN = 100;

export const DECODE_LAG_CRITICAL = 500;

/** Uplink 라운드(5분) — 모듈 내 컨트롤러 순환 주기 목표 · N대일 때 슬롯 간격 = 이 값÷N */
export const UPLINK_ROUND_SEC = 300;

export const HEALTH_REVALIDATE_SEC = 300;

export const INSERT_BUCKET_COUNT = 7;

export const INSERT_BUCKET_MINUTES = 5;

/** 동일 컨트롤러 last seen — 목표 5분 주기 · 초과 시 주의/경고 */
export const CONTROLLER_STALE_WARN_MIN = 10;

export const CONTROLLER_STALE_CRITICAL_MIN = 30;

/** Bar chart reference lines (minutes) — CONTROLLER_STALE_* 와 동기 */
export const MODULE_AGE_OK_MIN = CONTROLLER_STALE_WARN_MIN;

export const MODULE_AGE_CRITICAL_MIN = CONTROLLER_STALE_CRITICAL_MIN;
