/** v0x06 펌웨어 — 48 ctrl, SW 12×4 그룹 (STM32 comm_module) */

export const FIRMWARE_CTRL_COUNT = 48;
export const FIRMWARE_CTRL_IDX_MAX = 47;
export const FIRMWARE_SW_COUNT = 12;
export const FIRMWARE_CTRL_PER_SW = 4;

/** 레거시 v0x04 등 */
export const LEGACY_CTRL_COUNT = 50;

export function swIndexFromCtrlIdx(idx: number): number {
  return Math.floor(idx / FIRMWARE_CTRL_PER_SW);
}

export function ctrlBaseForSw(sw: number): number {
  return sw * FIRMWARE_CTRL_PER_SW;
}

export function swGroupLabel(sw: number): string {
  const base = ctrlBaseForSw(sw);
  const swNo = sw + 1;
  return `SW_${String(swNo).padStart(2, "0")} (ctrl ${base + 1}~${base + 4})`;
}

export function formatReplayIdxRange(
  idxMin: number | null | undefined,
  idxMax: number | null | undefined
): string {
  if (idxMin == null || idxMax == null) return "--";
  if (idxMin === idxMax) return `idx ${idxMin}`;
  return `idx ${idxMin}~${idxMax}`;
}
