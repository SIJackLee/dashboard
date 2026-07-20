/**
 * 명령 파이프라인 모듈 전역 id 추적 — TTL로 세션 누적 방지.
 */

export const COMMAND_PIPELINE_ID_TTL_MS = 30 * 60 * 1000;

export function pruneExpiredTimedIds(
  map: Map<string, number>,
  ttlMs: number,
  now = Date.now()
): void {
  for (const [id, at] of map) {
    if (now - at > ttlMs) map.delete(id);
  }
}

export function addTimedId(
  map: Map<string, number>,
  id: string,
  ttlMs: number = COMMAND_PIPELINE_ID_TTL_MS,
  now = Date.now()
): void {
  if (map.size > 200) pruneExpiredTimedIds(map, ttlMs, now);
  map.set(id, now);
}

export function hasTimedId(
  map: Map<string, number>,
  id: string,
  ttlMs: number = COMMAND_PIPELINE_ID_TTL_MS,
  now = Date.now()
): boolean {
  const at = map.get(id);
  if (at == null) return false;
  if (now - at > ttlMs) {
    map.delete(id);
    return false;
  }
  return true;
}
