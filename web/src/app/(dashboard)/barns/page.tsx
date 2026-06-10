import { PageShell } from "@/components/layout/page-shell";
import { BarnSummaryGrid } from "@/components/barns/barn-summary-grid";
import { BarnTable } from "@/components/barns/barn-table";
import { BarnStatusDonut } from "@/components/barns/barn-status-donut";
import { TempHumidityCompareChart } from "@/components/barns/temp-humidity-compare-chart";
import { FanCompareChart } from "@/components/barns/fan-compare-chart";
import { getLiveReadings, summarizeBarns } from "@/lib/data/iot";

export default async function BarnsPage() {
  const readings = await getLiveReadings();
  const summary = summarizeBarns(readings);

  return (
    <PageShell title="축사 현황">
      <BarnSummaryGrid summary={summary} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BarnStatusDonut summary={summary} />
        <TempHumidityCompareChart readings={readings} />
        <FanCompareChart readings={readings} />
      </div>
      <BarnTable rows={readings} />
    </PageShell>
  );
}
