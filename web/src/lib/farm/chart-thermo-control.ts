/** 차트 설정모드 — 설정온도·편차 가이드 색 (알람과 구분) */
export const CHART_THERMO_CONTROL_COLOR = "#7c3aed";

export type ChartThermoDraft = {
  setpointTemp: number;
  tempDeviation: number;
};

/**
 * 설정온도 = 최저환기 기점, 설정+편차 = 최고환기 기점.
 * 편차는 설정온도 위쪽(한쪽)만 존재한다.
 */
export const CHART_THERMO_EDGE_IDS = {
  setpoint: "thermo-setpoint",
  /** 설정온도 + 온도편차 (최고환기) */
  maxVent: "thermo-max-vent",
} as const;

export type ChartThermoEdgeId =
  (typeof CHART_THERMO_EDGE_IDS)[keyof typeof CHART_THERMO_EDGE_IDS];

export function isChartThermoEdgeId(id: string): id is ChartThermoEdgeId {
  return (
    id === CHART_THERMO_EDGE_IDS.setpoint ||
    id === CHART_THERMO_EDGE_IDS.maxVent
  );
}
