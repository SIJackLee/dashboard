import { PageShell } from "@/components/layout/page-shell";
import { LogFilterBar } from "@/components/logs/log-filter-bar";
import { LogSummaryGrid } from "@/components/logs/log-summary-grid";
import { HourlyEventChart } from "@/components/logs/hourly-event-chart";
import { LogTable } from "@/components/logs/log-table";

export default function LogsPage() {
  return (
    <PageShell title="시간대별 기록">
      <LogFilterBar />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LogSummaryGrid />
        <HourlyEventChart />
      </div>
      <LogTable />
    </PageShell>
  );
}
