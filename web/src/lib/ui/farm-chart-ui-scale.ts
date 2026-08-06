/**
 * A안 — 농장 차트 탭 UI·텍스트 일괄 배율.
 * 현장 목록·카드 미니차트에는 적용하지 않는다 (기본 1×).
 * CSS `.farm-chart-ui { --farm-chart-ui-scale }` 과 동일 값을 유지한다.
 */
export const FARM_CHART_UI_SCALE = 2;

export function chartUiPx(base: number, scale = FARM_CHART_UI_SCALE): number {
  return Math.round(base * scale * 100) / 100;
}

/** Tailwind 리터럴 대체용 클래스 (globals.css) — 스케일은 조상 `.farm-chart-ui` 에만 2× */
export const farmChartUi = {
  root: "farm-chart-ui",
  fsLegend: "farm-chart-fs-legend",
  fsMeta: "farm-chart-fs-meta",
  fsTitle: "farm-chart-fs-title",
  fsBody: "farm-chart-fs-body",
  fsAxis: "farm-chart-fs-axis",
  control: "farm-chart-control",
  tickRail: "farm-chart-tick-rail",
} as const;
