import { SectionCard } from "@/components/common/section-card";
import {
  BarnMetricChartStack,
  type BarnMetricDef,
} from "@/components/barns/barn-metric-chart-stack";
import type { ControllerSlotReading } from "@/lib/data/iot-chart";
import { FIRMWARE_CTRL_COUNT } from "@/lib/data/iot-firmware";

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
    <SectionCard title="온습도 비교" description={`LIVE 컨트롤러 1~${FIRMWARE_CTRL_COUNT} (v0x06)`}>
      <BarnMetricChartStack readings={readings} metrics={METRICS} />
    </SectionCard>
  );
}
