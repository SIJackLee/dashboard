/** 차트 설정모드 — 설정온도·편차·환기 가이드 색 (알람과 구분) */
export const CHART_THERMO_CONTROL_COLOR = "#7c3aed";

export type ChartThermoDraft = {
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
};

/**
 * 온도 밴드: 설정온도 = 최저환기 기점, 설정+편차 = 최고환기 기점.
 * 모터 밴드: 최저·최고 환기량(%).
 */
export const CHART_THERMO_EDGE_IDS = {
  setpoint: "thermo-setpoint",
  /** 설정온도 + 온도편차 (최고환기 도달 온도) */
  highVentTemp: "thermo-max-vent",
  minVentPct: "thermo-min-vent-pct",
  maxVentPct: "thermo-max-vent-pct",
} as const;

export type ChartThermoEdgeId =
  (typeof CHART_THERMO_EDGE_IDS)[keyof typeof CHART_THERMO_EDGE_IDS];

export function isChartThermoEdgeId(id: string): id is ChartThermoEdgeId {
  return (
    id === CHART_THERMO_EDGE_IDS.setpoint ||
    id === CHART_THERMO_EDGE_IDS.highVentTemp ||
    id === CHART_THERMO_EDGE_IDS.minVentPct ||
    id === CHART_THERMO_EDGE_IDS.maxVentPct
  );
}

export function isChartMotorVentEdgeId(id: string): boolean {
  return (
    id === CHART_THERMO_EDGE_IDS.minVentPct ||
    id === CHART_THERMO_EDGE_IDS.maxVentPct
  );
}

export function clampChartVentDraft(
  draft: ChartThermoDraft,
  edited: "minVentPct" | "maxVentPct",
): ChartThermoDraft {
  let minVentPct = draft.minVentPct;
  let maxVentPct = draft.maxVentPct;
  if (edited === "minVentPct" && minVentPct > maxVentPct) {
    maxVentPct = minVentPct;
  }
  if (edited === "maxVentPct" && maxVentPct < minVentPct) {
    minVentPct = maxVentPct;
  }
  return { ...draft, minVentPct, maxVentPct };
}
