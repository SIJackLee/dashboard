import { PageShell } from "@/components/layout/page-shell";
import { LogFilterBar } from "@/components/logs/log-filter-bar";
import { LogSummaryGrid } from "@/components/logs/log-summary-grid";
import { HourlyEventChart } from "@/components/logs/hourly-event-chart";
import { LogTable } from "@/components/logs/log-table";
import { getLogEvents } from "@/lib/data/iot-replay";

export default async function LogsPage() {
  const events = await getLogEvents(50);

  return (
    <PageShell title="시간대별 기록">
      <LogFilterBar replayCount={events.length} />
      <LogSummaryGrid events={events} />
      <HourlyEventChart events={events} />
      <LogTable events={events} />
    </PageShell>
  );
}
