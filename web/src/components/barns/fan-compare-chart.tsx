import { SectionCard } from "@/components/common/section-card";
import {
  BarnMetricChartStack,
  type BarnMetricDef,
} from "@/components/barns/barn-metric-chart-stack";
import type { ControllerSlotReading } from "@/lib/data/iot-chart";
import { FIRMWARE_CTRL_COUNT } from "@/lib/data/iot-firmware";

const METRICS: BarnMetricDef[] = [
  { key: "fanSupply", label: "송풍팬", unit: "%", max: 100, barClassName: "bg-emerald-500" },
  { key: "fanExhaust", label: "배기팬", unit: "%", max: 100, barClassName: "bg-sky-600" },
  { key: "fanIntake", label: "입기팬", unit: "%", max: 100, barClassName: "bg-violet-500" },
];

type FanCompareChartProps = {
  readings?: ControllerSlotReading[];
};

export function FanCompareChart({ readings = [] }: FanCompareChartProps) {
  return (
    <SectionCard title="팬 비교" description={`LIVE 컨트롤러 1~${FIRMWARE_CTRL_COUNT} (v0x06)`}>
      <BarnMetricChartStack readings={readings} metrics={METRICS} />
    </SectionCard>
  );
}
