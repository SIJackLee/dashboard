import { TopBar } from "./top-bar";
import { deriveAlarmsFromReadings } from "@/lib/data/alarms";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  filterReadingsByFarmKey,
  resolveActiveFarmKey,
  type FarmQueryParams,
} from "@/lib/auth/farm-access";
import { getLiveReadings } from "@/lib/data/iot";
import {
  summarizeControllers,
  toFarmOverview,
} from "@/lib/data/dashboard-summary";
import {
  buildFarmSummaries,
  uniqueFarmKeysFromReadings,
} from "@/lib/data/farm-summaries";
import { FIRMWARE_CTRL_COUNT } from "@/lib/data/iot-firmware";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type PageShellProps = {
  title: string;
  children: React.ReactNode;
  /** 농장 지도 등 넓은 레이아웃 */
  wide?: boolean;
  searchParams?: FarmQueryParams;
};

export async function PageShell({
  title,
  children,
  wide = false,
  searchParams = {},
}: PageShellProps) {
  const [readings, alarmSettings, user] = await Promise.all([
    getLiveReadings(),
    getAlarmSettings(),
    getCurrentUser(),
  ]);

  const activeFarmKey = user ? resolveActiveFarmKey(user, searchParams) : null;
  const scopedReadings = filterReadingsByFarmKey(readings, activeFarmKey);
  const overview = toFarmOverview(
    summarizeControllers(scopedReadings, FIRMWARE_CTRL_COUNT)
  );
  const alarms = deriveAlarmsFromReadings(scopedReadings, alarmSettings);
  const farmOptions =
    user?.isAdmin ? uniqueFarmKeysFromReadings(readings) : [];
  const allAlarms = deriveAlarmsFromReadings(readings, alarmSettings);
  const farmSummaries =
    user?.isAdmin ? buildFarmSummaries(readings, allAlarms) : [];

  return (
    <>
      <TopBar
        title={title}
        overview={overview}
        alarms={alarms}
        isAdmin={user?.isAdmin ?? false}
        farmOptions={farmOptions}
        activeFarmKey={activeFarmKey}
        farmSummaries={farmSummaries}
      />
      <main className={dashboardUi.mainPad}>
        <div
          className={cn(
            dashboardUi.pageStack,
            wide ? "max-w-[1600px]" : "max-w-screen-2xl"
          )}
        >
          {children}
        </div>
      </main>
    </>
  );
}
