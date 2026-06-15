import { Warehouse, Cpu, Boxes, WifiOff } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { Badge } from "@/components/ui/badge";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import type { FarmOverview } from "@/lib/data/iot";
import { cn } from "@/lib/utils";

export function FarmSummaryGrid({
  overview,
  liveCtrlHint,
  compact = false,
  className,
}: {
  overview?: FarmOverview;
  liveCtrlHint?: string;
  compact?: boolean;
  className?: string;
}) {
  const fmt = (n?: number) => (n === undefined ? "--" : String(n));

  if (compact) {
    return (
      <SectionCard
        title="농장 요약"
        className={cn(
          "h-full w-full",
          dashboardUi.overviewPanelMinH,
          className
        )}
        contentClassName="flex flex-1 flex-col min-h-0"
      >
        {liveCtrlHint && (
          <Badge variant="outline" className={cn(dashboardUi.badgeMd, "mb-3")}>
            {liveCtrlHint}
          </Badge>
        )}
        <div className="grid flex-1 grid-cols-2 gap-3">
          <StatCard
            label="농장 수"
            icon={Warehouse}
            accent="emerald"
            value={fmt(overview?.farmCount)}
            compact
            fill
          />
          <StatCard
            label="통신박스 수"
            icon={Boxes}
            accent="sky"
            value={fmt(overview?.moduleCount)}
            compact
            fill
          />
          <StatCard
            label="컨트롤러 수"
            icon={Cpu}
            value={fmt(overview?.controllerCount)}
            compact
            fill
          />
          <StatCard
            label="오프라인"
            icon={WifiOff}
            accent="red"
            value={fmt(overview?.offlineCount)}
            compact
            fill
          />
        </div>
      </SectionCard>
    );
  }

  return (
    <div className={cn("space-y-3 rounded-xl border bg-card p-5 ring-1 ring-foreground/10", className)}>
      {liveCtrlHint && (
        <Badge variant="outline" className={dashboardUi.badgeMd}>
          {liveCtrlHint}
        </Badge>
      )}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-2">
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
