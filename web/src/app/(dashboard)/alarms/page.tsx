import { PageShell } from "@/components/layout/page-shell";
import { AlarmSummaryGrid } from "@/components/alarms/alarm-summary-grid";
import { AlarmFilterBar } from "@/components/alarms/alarm-filter-bar";
import { AlarmTable } from "@/components/alarms/alarm-table";
import { AlarmDetailPanel } from "@/components/alarms/alarm-detail-panel";
import { deriveAlarmsFromReadings, summarizeAlarms } from "@/lib/data/alarms";
import { getLiveReadings } from "@/lib/data/iot";

export default async function AlarmsPage() {
  const readings = await getLiveReadings();
  const alarms = deriveAlarmsFromReadings(readings);
  const summary = summarizeAlarms(alarms);

  return (
    <PageShell title="이상 상태 알림">
      <AlarmSummaryGrid summary={summary} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <AlarmFilterBar total={summary.total} />
          <AlarmTable alarms={alarms} />
        </div>
        <AlarmDetailPanel alarm={alarms[0]} />
      </div>
    </PageShell>
  );
}
