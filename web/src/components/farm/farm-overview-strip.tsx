import type { FarmOverview } from "@/lib/data/iot";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { FarmSummaryGrid } from "@/components/farm/farm-summary-grid";
import { EnvAveragePanel } from "@/components/farm/env-average-panel";
import { RecentActivityList } from "@/components/farm/recent-activity-list";

type Props = {
  overview: FarmOverview;
};

export function FarmOverviewStrip({ overview }: Props) {
  return (
    <div className={dashboardUi.overviewStrip}>
      <div className={cn(dashboardUi.overviewCol, "2xl:col-span-4")}>
        <FarmSummaryGrid overview={overview} compact className="w-full" />
      </div>
      <div className={cn(dashboardUi.overviewCol, "2xl:col-span-4")}>
        <EnvAveragePanel overview={overview} variant="compact" />
      </div>
      <div className={cn(dashboardUi.overviewCol, "2xl:col-span-4")}>
        <RecentActivityList receipts={overview.receipts} variant="compact" />
      </div>
    </div>
  );
}
