export type HubRailDir = "up" | "down" | "left" | "right";

export const RAIL_PITCH_BASE = 52;
export const RAIL_GROUP_GAP_DEFAULT = 8;

/** 축 거리 → FAB 중심 기준 (ox, oy). 거리 양수 = 레일 방향 */
export function railOffset(
  dir: HubRailDir,
  distance: number,
): { ox: number; oy: number } {
  if (dir === "up") return { ox: 0, oy: -distance };
  if (dir === "down") return { ox: 0, oy: distance };
  if (dir === "left") return { ox: -distance, oy: 0 };
  return { ox: distance, oy: 0 };
}

/**
 * 도구 아이템 축 거리(등간격).
 * 거리 = (i+1) * pitch — FAB 중심에서 바깥으로.
 */
export function hubRailToolDistances(
  toolCount: number,
  pitch: number,
  _isAdmin?: boolean,
  _groupGap = RAIL_GROUP_GAP_DEFAULT,
): number[] {
  const distances: number[] = [];
  for (let i = 0; i < toolCount; i++) {
    distances.push((i + 1) * pitch);
  }
  return distances;
}
