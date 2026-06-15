import { FanIndicator, type FanKind } from "@/components/common/fan-indicator";
import { Sparkline } from "@/components/common/sparkline";
import type { ControllerReading } from "@/lib/data/iot";
import { sensorValueForDisplay } from "@/lib/data/reading-display";

type FanConf = {
  kind: FanKind;
  value: number | null;
  series: number[];
};

// 송풍/배기/입기 팬 % 게이지 + 추이 스파크라인
export function FanGaugeGroup({ reading }: { reading?: ControllerReading }) {
  const online = reading?.status !== "offline";
  const fans: FanConf[] = [
    {
      kind: "supply",
      value: sensorValueForDisplay(reading?.status, reading?.fanSupply),
      series: online ? (reading?.fanSupplySeries ?? []) : [],
    },
    {
      kind: "exhaust",
      value: sensorValueForDisplay(reading?.status, reading?.fanExhaust),
      series: online ? (reading?.fanExhaustSeries ?? []) : [],
    },
    {
      kind: "intake",
      value: sensorValueForDisplay(reading?.status, reading?.fanIntake),
      series: online ? (reading?.fanIntakeSeries ?? []) : [],
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {fans.map((f) => (
        <div key={f.kind} className="space-y-2 rounded-lg border p-4">
          <FanIndicator kind={f.kind} value={f.value} />
          <Sparkline data={f.series} />
        </div>
      ))}
    </div>
  );
}
