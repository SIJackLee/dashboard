import {
  binWorst,
  severityScore,
  sevOfScore,
  worstSev,
  type Band,
  type Sev,
} from "@/lib/farm/severity-score";

/** 아래(index 0) → 위 순서로 히트맵/상세 행에 쌓인다. */
export type StackMetric = {
  id: string;
  label: string;
  values: (number | null)[];
  band: Band | null;
  unit?: string;
};

export type StackMetricRow = { metric: StackMetric; sevs: Sev[] };

export function computeStackMetricRows(
  metrics: StackMetric[],
  bars?: number,
): StackMetricRow[] {
  return metrics.map((m) => {
    const scores = m.values.map((v) => severityScore(v, m.band));
    const binned = bars ? binWorst(scores, bars) : scores;
    return { metric: m, sevs: binned.map((s) => sevOfScore(s)) };
  });
}

export function worstStackMetricSev(rows: StackMetricRow[]): Sev {
  return worstSev(rows.flatMap((r) => r.sevs));
}

export function worstSingleStackMetric(metric: StackMetric): Sev {
  return worstSev(
    metric.values.map((v) => sevOfScore(severityScore(v, metric.band))),
  );
}

/** 시계열 마지막 유효값 = 현재값. */
export function currentStackMetricValue(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const v = values[i];
    if (v != null && Number.isFinite(v)) return v;
  }
  return null;
}

export function formatStackMetricValue(v: number | null, unit?: string): string {
  if (v == null) return "—";
  const rounded = unit === "℃" ? Math.round(v * 10) / 10 : Math.round(v);
  return `${rounded}${unit ?? ""}`;
}
