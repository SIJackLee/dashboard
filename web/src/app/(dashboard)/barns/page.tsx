import { PageShell } from "@/components/layout/page-shell";
import { BarnSummaryGrid } from "@/components/barns/barn-summary-grid";
import { BarnTable } from "@/components/barns/barn-table";
import { BarnStatusDonut } from "@/components/barns/barn-status-donut";
import { BarnEnvCompareChart } from "@/components/barns/barn-env-compare-chart";
import { QuickComparePanel } from "@/components/barns/quick-compare-panel";
import { getBarnReadings, summarizeBarns } from "@/lib/data/iot";

export default async function BarnsPage() {
  const readings = await getBarnReadings();
  const summary = summarizeBarns(readings);

  return (
    <PageShell title="축사 현황">
      <BarnSummaryGrid summary={summary} />
      <BarnTable rows={readings} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BarnStatusDonut />
        <BarnEnvCompareChart />
        <QuickComparePanel />
      </div>
    </PageShell>
  );
}
