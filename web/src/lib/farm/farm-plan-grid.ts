/**
 * 모델 탭 — 농장 격자 칸. x/z 가 옛 비율(%)이면 칸으로 접는다.
 */
export function farmPlanGridCols(compact: boolean): 2 | 3 {
  return compact ? 2 : 3;
}

export type FarmPlanCell = { col: number; row: number };

function cellKey(cell: FarmPlanCell): string {
  return `${cell.col},${cell.row}`;
}

function isGridIndex(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 7;
}

/** 저장값 → 칸. 0,0 묶음은 index로 펼친다. */
export function parseFarmPlanCell(
  building: { x: number; z: number },
  index: number,
  cols: number,
): FarmPlanCell {
  const x = building.x;
  const z = building.z;
  if (x === 0 && z === 0) {
    return { col: index % cols, row: Math.floor(index / cols) };
  }
  if (isGridIndex(x) && isGridIndex(z)) {
    return { col: Math.min(cols - 1, x), row: z };
  }
  const col = Math.min(
    cols - 1,
    Math.max(0, Math.round((Number(x) - 22) / 28)),
  );
  const row = Math.min(7, Math.max(0, Math.round((Number(z) - 30) / 32)));
  return { col, row };
}

export function nextEmptyFarmPlanCell(
  occupied: FarmPlanCell[],
  cols: number,
): FarmPlanCell {
  const used = new Set(occupied.map(cellKey));
  for (let i = 0; i < 64; i += 1) {
    const cell = { col: i % cols, row: Math.floor(i / cols) };
    if (!used.has(cellKey(cell))) return cell;
  }
  return { col: 0, row: Math.ceil(occupied.length / cols) };
}

export function assignFarmPlanCells<T extends { id: string; x: number; z: number }>(
  buildings: T[],
  cols: number,
): Map<string, FarmPlanCell> {
  const map = new Map<string, FarmPlanCell>();
  const used: FarmPlanCell[] = [];
  buildings.forEach((building, index) => {
    let cell = parseFarmPlanCell(building, index, cols);
    const taken = used.some((u) => u.col === cell.col && u.row === cell.row);
    if (taken) cell = nextEmptyFarmPlanCell(used, cols);
    used.push(cell);
    map.set(building.id, cell);
  });
  return map;
}

export function farmPlanGridSize(
  cells: FarmPlanCell[],
  cols: number,
  extraEmpty: boolean,
): { cols: number; rows: number } {
  const maxRow = cells.reduce((m, c) => Math.max(m, c.row), -1);
  const occupied = cells.length;
  const need = Math.max(extraEmpty ? occupied + 1 : occupied, extraEmpty ? 1 : 0);
  const rowsFromNeed = Math.ceil(Math.max(need, 1) / cols);
  const rows = Math.max(2, maxRow + 1, rowsFromNeed);
  return { cols, rows };
}
