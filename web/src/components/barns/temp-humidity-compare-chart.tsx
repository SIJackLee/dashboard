import { SectionCard } from "@/components/common/section-card";
import {
  BarnMetricChartStack,
  type BarnMetricDef,
} from "@/components/barns/barn-metric-chart-stack";
import type { ControllerSlotReading } from "@/lib/data/iot-chart";

const METRICS: BarnMetricDef[] = [
  { key: "tempC", label: "온도", unit: "℃", max: 40, barClassName: "bg-orange-500" },
  { key: "humidityPct", label: "습도", unit: "%", max: 100, barClassName: "bg-sky-500" },
];

type TempHumidityCompareChartProps = {
  readings?: ControllerSlotReading[];
};

export function TempHumidityCompareChart({
  readings = [],
}: TempHumidityCompareChartProps) {
  return (
    <SectionCard title="온습도 비교" description="컨트롤러 1~50">
      <BarnMetricChartStack readings={readings} metrics={METRICS} />
    </SectionCard>
  );
}
