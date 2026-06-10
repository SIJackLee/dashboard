import { Warehouse, Cpu, Boxes, WifiOff } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import type { FarmOverview } from "@/lib/data/iot";

export function FarmSummaryGrid({
  overview,
  liveCtrlHint,
}: {
  overview?: FarmOverview;
  liveCtrlHint?: string;
}) {
  const fmt = (n?: number) => (n === undefined ? "--" : String(n));
  return (
    <div className="space-y-2">
      {liveCtrlHint && (
        <Badge variant="outline" className="text-xs">
          {liveCtrlHint}
        </Badge>
      )}
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
    </div>
  );
}
