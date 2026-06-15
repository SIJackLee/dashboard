import { AlertTriangle, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FarmSummaryRow } from "@/lib/data/farm-summaries";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export function FarmStatusBadge({ farm }: { farm: FarmSummaryRow }) {
  if (farm.offlineCount > 0) {
    return (
      <Badge variant="outline" className={dashboardUi.badgeMd}>
        <WifiOff className="mr-1 size-3.5" aria-hidden />
        오프라인 {farm.offlineCount}
      </Badge>
    );
  }

  if (farm.alarmCount > 0) {
    return (
      <Badge
        variant="outline"
        className={cn(
          dashboardUi.badgeMd,
          "border-amber-300/50 text-amber-700 dark:text-amber-400"
        )}
      >
        <AlertTriangle className="mr-1 size-3.5" aria-hidden />
        알람 {farm.alarmCount}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        dashboardUi.badgeMd,
        "border-emerald-300/50 text-emerald-700 dark:text-emerald-400"
      )}
    >
      정상
    </Badge>
  );
}
