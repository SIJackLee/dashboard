import { PageShell } from "@/components/layout/page-shell";
import { AlarmsView } from "@/components/alarms/alarms-view";
import { filterReadingsByFarmKey, resolveActiveFarmKey } from "@/lib/auth/farm-access";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { deriveAlarmsFromReadings, summarizeAlarms } from "@/lib/data/alarms";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import { getLiveReadings } from "@/lib/data/iot";

export default async function AlarmsPage({
  searchParams,
}: {
  searchParams: Promise<{ alarm?: string; lsind?: string; item?: string }>;
}) {
  const params = await searchParams;
  const { alarm: alarmId, lsind, item } = params;
  const [readings, alarmSettings, user] = await Promise.all([
    getLiveReadings(),
    getAlarmSettings(),
    getCurrentUser(),
  ]);

  const activeFarmKey = user ? resolveActiveFarmKey(user, params) : null;
  const scopedReadings = filterReadingsByFarmKey(readings, activeFarmKey);
  const alarms = deriveAlarmsFromReadings(scopedReadings, alarmSettings);
  const summary = summarizeAlarms(alarms);

  return (
    <PageShell title="이상 상태 알림" searchParams={{ lsind, item }}>
      <AlarmsView
        alarms={alarms}
        summary={summary}
        selectedId={alarmId}
        groupByFarm={Boolean(user?.isAdmin && !activeFarmKey)}
      />
    </PageShell>
  );
}
