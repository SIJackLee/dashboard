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
 * 도구 아이템 축 거리(차트 제외).
 * 순서: 테마·뷰포트 | 리포트·운영 | 이상상황(벨)
 */
export function hubRailToolDistances(
  toolCount: number,
  pitch: number,
  isAdmin: boolean,
  groupGap = RAIL_GROUP_GAP_DEFAULT,
): number[] {
  const distances: number[] = [];
  let d = 0;
  for (let i = 0; i < toolCount; i++) {
    d += pitch;
    distances.push(d);
    const afterDesign = i === 1;
    const afterFunction = isAdmin ? i === 3 : i === 2;
    if (afterDesign || afterFunction) d += groupGap;
  }
  return distances;
}
