import { PageShell } from "@/components/layout/page-shell";
import { AlarmSummaryGrid } from "@/components/alarms/alarm-summary-grid";
import { AlarmFilterBar } from "@/components/alarms/alarm-filter-bar";
import { AlarmTable } from "@/components/alarms/alarm-table";
import { AlarmDetailPanel } from "@/components/alarms/alarm-detail-panel";

export default function AlarmsPage() {
  return (
    <PageShell title="이상 상태 알림">
      <AlarmSummaryGrid />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <AlarmFilterBar />
          <AlarmTable />
        </div>
        <AlarmDetailPanel />
      </div>
    </PageShell>
  );
}
