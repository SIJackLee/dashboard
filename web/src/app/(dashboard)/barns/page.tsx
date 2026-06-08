import { PageShell } from "@/components/layout/page-shell";
import { BarnSummaryGrid } from "@/components/barns/barn-summary-grid";
import { BarnTable } from "@/components/barns/barn-table";
import { BarnStatusDonut } from "@/components/barns/barn-status-donut";
import { BarnEnvCompareChart } from "@/components/barns/barn-env-compare-chart";
import { QuickComparePanel } from "@/components/barns/quick-compare-panel";

export default function BarnsPage() {
  return (
    <PageShell title="축사 현황">
      <BarnSummaryGrid />
      <BarnTable />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BarnStatusDonut />
        <BarnEnvCompareChart />
        <QuickComparePanel />
      </div>
    </PageShell>
  );
}
