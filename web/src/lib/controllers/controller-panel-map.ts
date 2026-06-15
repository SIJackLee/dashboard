export type PanelMenuId = "setpoint" | "deviation" | "minVent" | "maxVent";

export type PanelMenuStep = {
  step: number;
  min: number;
  max: number;
  unit: string;
  decimals: number;
};

export const PANEL_MENU_ITEMS: { id: PanelMenuId; label: string }[] = [
  { id: "setpoint", label: "설정 온도" },
  { id: "deviation", label: "온도 편차" },
  { id: "minVent", label: "최저 환기" },
  { id: "maxVent", label: "최고 환기" },
];

export const MENU_STEPS: Record<PanelMenuId, PanelMenuStep> = {
  setpoint: { step: 0.5, min: 20, max: 30, unit: "℃", decimals: 1 },
  deviation: { step: 0.5, min: 0.5, max: 5, unit: "℃", decimals: 1 },
  minVent: { step: 5, min: 0, max: 100, unit: "%", decimals: 0 },
  maxVent: { step: 5, min: 0, max: 100, unit: "%", decimals: 0 },
};

/** 명령·설정 이력 없을 때 편집 시작값 */
export const EDIT_START_DRAFT = {
  setpointTemp: 25,
  tempDeviation: 2,
  minVentPct: 10,
  maxVentPct: 100,
};

export function clampMenuValue(menu: PanelMenuId, raw: number): number {
  const cfg = MENU_STEPS[menu];
  const steps = Math.round((raw - cfg.min) / cfg.step);
  let snapped = cfg.min + steps * cfg.step;
  if (cfg.decimals === 0) {
    snapped = Math.round(snapped);
  } else {
    const factor = 10 ** cfg.decimals;
    snapped = Math.round(snapped * factor) / factor;
  }
  return Math.min(cfg.max, Math.max(cfg.min, snapped));
}

export function formatMenuValue(menu: PanelMenuId, value: number): string {
  const cfg = MENU_STEPS[menu];
  const n =
    cfg.decimals === 0 ? String(Math.round(value)) : value.toFixed(cfg.decimals);
  return cfg.unit === "℃" ? `${n}℃` : `${n}%`;
}
