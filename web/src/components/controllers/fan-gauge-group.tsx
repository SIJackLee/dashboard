import { FanIndicator, type FanKind } from "@/components/common/fan-indicator";
import { Sparkline } from "@/components/common/sparkline";
import type { ControllerReading } from "@/lib/data/iot";

type FanConf = {
  kind: FanKind;
  value: number | null;
  series: number[];
};

// 송풍/배기/입기 팬 % 게이지 + 추이 스파크라인
export function FanGaugeGroup({ reading }: { reading?: ControllerReading }) {
  const fans: FanConf[] = [
    {
      kind: "supply",
      value: reading?.fanSupply ?? null,
      series: reading?.fanSupplySeries ?? [],
    },
    {
      kind: "exhaust",
      value: reading?.fanExhaust ?? null,
      series: reading?.fanExhaustSeries ?? [],
    },
    {
      kind: "intake",
      value: reading?.fanIntake ?? null,
      series: reading?.fanIntakeSeries ?? [],
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
