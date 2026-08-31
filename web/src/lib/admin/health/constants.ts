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

/**
 * Health RS insert 버킷 수.
 * insertRateStatus는 최근 2칸만 보므로 3칸이면 충분 (구 7칸 → DB count 왕복 축소).
 */
export const INSERT_BUCKET_COUNT = 3;

export const INSERT_BUCKET_MINUTES = 5;

/** 동일 컨트롤러 last seen — 목표 5분 주기 · 초과 시 주의/경고 */
export const CONTROLLER_STALE_WARN_MIN = 10;

export const CONTROLLER_STALE_CRITICAL_MIN = 30;

/**
 * instance_health_current(rsd-healthcheck.timer) 신선도.
 * checked_at이 이 값을 넘으면 updater 지연 → per-service 값 신뢰 저하.
 * WARN 초과: 주의 point 부착 · UNKNOWN 초과: per-service 무시하고 기존 추정으로 폴백.
 */
export const INSTANCE_HEALTH_STALE_WARN_SEC = 600;

export const INSTANCE_HEALTH_STALE_UNKNOWN_SEC = 1800;

/** EC2 자원 경고 임계 — 가용 메모리(MB) 하한 / 루트 디스크 사용률(%) 상한 */
export const INSTANCE_MEM_WARN_MB = 200;

export const INSTANCE_DISK_WARN_PCT = 85;
