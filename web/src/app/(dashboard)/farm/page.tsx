import { PageShell } from "@/components/layout/page-shell";
import { FarmMapView } from "@/components/farm/farm-map-view";
import { FarmSummaryGrid } from "@/components/farm/farm-summary-grid";
import { EnvAveragePanel } from "@/components/farm/env-average-panel";
import { ConnectionFlow } from "@/components/farm/connection-flow";
import { SignalStrengthBar } from "@/components/farm/signal-strength-bar";
import { RecentActivityList } from "@/components/farm/recent-activity-list";
import { getBarnReadings, summarizeFarm } from "@/lib/data/iot";

export default async function FarmPage() {
  const readings = await getBarnReadings();
  const overview = summarizeFarm(readings);

  return (
    <PageShell title="농장 현황">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <FarmMapView />
          <ConnectionFlow overview={overview} />
          <SignalStrengthBar />
        </div>
        <div className="space-y-6">
          <FarmSummaryGrid overview={overview} />
          <EnvAveragePanel overview={overview} />
          <RecentActivityList receipts={overview.receipts} />
        </div>
      </div>
    </PageShell>
  );
}
