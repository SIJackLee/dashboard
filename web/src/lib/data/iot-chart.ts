/** 클라이언트 차트용 — server-only 없음 */

export const CONTROLLER_SLOT_COUNT = 50;

export type ControllerMetricKey =
  | "tempC"
  | "humidityPct"
  | "fanSupply"
  | "fanExhaust"
  | "fanIntake";

export type ControllerSlotReading = {
  idx: number;
  farmUid: number;
  moduleUid: number;
  label: string;
  tempC: number | null;
  humidityPct: number | null;
  fanSupply: number | null;
  fanExhaust: number | null;
  fanIntake: number | null;
};

export type ChartSlotItem = {
  label: string;
  value: number | null;
  title?: string;
};

/** 환경 비교 차트: x축 컨트롤러 1~50 (idx+1) 고정 슬롯 */
export function buildControllerSlotSeries(
  readings: ControllerSlotReading[],
  metric: ControllerMetricKey
): ChartSlotItem[] {
  const bySlot = new Map<number, ControllerSlotReading[]>();
  for (const r of readings) {
    const slot = r.idx + 1;
    if (slot < 1 || slot > CONTROLLER_SLOT_COUNT) continue;
    const list = bySlot.get(slot) ?? [];
    list.push(r);
    bySlot.set(slot, list);
  }

  return Array.from({ length: CONTROLLER_SLOT_COUNT }, (_, i) => {
    const slot = i + 1;
    const matched = bySlot.get(slot) ?? [];
    const metricValues = matched
      .map((m) => m[metric])
      .filter((v): v is number => v !== null);
    const value =
      metricValues.length > 0
        ? metricValues.reduce((a, b) => a + b, 0) / metricValues.length
        : null;
    const title =
      matched.length === 0
        ? `컨트롤러 ${slot}: 데이터 없음`
        : matched
            .map((m) => {
              const v = m[metric];
              return `${m.label} (farm ${m.farmUid}/통신박스 ${m.moduleUid}): ${
                v === null ? "--" : v.toFixed(1)
              }`;
            })
            .join(" · ");

    return { label: String(slot), value, title };
  });
}
