type GridPos = { col: number; row: number };
type WithGrid = { grid: GridPos };

/** 게이트웨이(col:2, row:1) 인근부터 축사 카드 배치 우선 순위 */
export const BARN_GRID_SLOTS: GridPos[] = [
  { col: 1, row: 2 },
  { col: 3, row: 2 },
  { col: 4, row: 2 },
  { col: 1, row: 3 },
  { col: 3, row: 3 },
  { col: 4, row: 3 },
  { col: 1, row: 4 },
  { col: 2, row: 4 },
  { col: 3, row: 4 },
  { col: 4, row: 4 },
  { col: 1, row: 1 },
  { col: 3, row: 1 },
  { col: 4, row: 1 },
  { col: 2, row: 2 },
  { col: 2, row: 3 },
];

export function gridKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** 통신 게이트웨이 고정 칸 (드롭 불가) */
export function isGatewayCell(col: number, row: number): boolean {
  return col === 2 && row === 1;
}

export const GRID_COLS = 4;
export const GRID_ROWS = 4;

/** 기존 항목과 겹치지 않는 다음 그리드 칸 */
export function pickNextGridSlot(existing: WithGrid[]): GridPos {
  const used = new Set(existing.map((b) => gridKey(b.grid.col, b.grid.row)));
  for (const slot of BARN_GRID_SLOTS) {
    if (!used.has(gridKey(slot.col, slot.row))) return slot;
  }
  return BARN_GRID_SLOTS[existing.length % BARN_GRID_SLOTS.length];
}

/** 동일 그리드 칸 충돌 시 빈 칸으로 자동 재배치 */
export function resolveBarnGridCollisions<T extends WithGrid>(barns: T[]): T[] {
  const placed: T[] = [];
  for (const barn of barns) {
    const key = gridKey(barn.grid.col, barn.grid.row);
    const occupied = new Set(placed.map((b) => gridKey(b.grid.col, b.grid.row)));
    const grid = occupied.has(key) ? pickNextGridSlot(placed) : barn.grid;
    placed.push({ ...barn, grid });
  }
  return placed;
}
