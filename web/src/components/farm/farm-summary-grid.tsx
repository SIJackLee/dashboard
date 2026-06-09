import { Warehouse, Cpu, Boxes, WifiOff } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import type { FarmOverview } from "@/lib/data/iot";

export function FarmSummaryGrid({ overview }: { overview?: FarmOverview }) {
  const fmt = (n?: number) => (n === undefined ? "--" : String(n));
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard
        label="농장 수"
        icon={Warehouse}
        accent="emerald"
        value={fmt(overview?.farmCount)}
      />
      <StatCard
        label="통신박스 수"
        icon={Boxes}
        accent="sky"
        value={fmt(overview?.moduleCount)}
      />
      <StatCard
        label="컨트롤러 수"
        icon={Cpu}
        value={fmt(overview?.controllerCount)}
      />
      <StatCard
        label="오프라인"
        icon={WifiOff}
        accent="red"
        value={fmt(overview?.offlineCount)}
      />
    </div>
  );
}
