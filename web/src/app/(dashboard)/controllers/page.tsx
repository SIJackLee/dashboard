import { Suspense } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { ControllersView } from "@/components/controllers/controllers-view";
import { resolveActiveFarmKey } from "@/lib/auth/farm-access";
import { getCurrentUser, canCommand } from "@/lib/auth/get-current-user";
import { deriveAlarmsFromReadings } from "@/lib/data/alarms";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import { buildFarmSummaries } from "@/lib/data/farm-summaries";

import { getThermoCommandHistory, getThermoSettingsMap } from "@/lib/data/commands";

import {
  buildThermoSettingsFromReadings,
  mergeThermoSettingsMaps,
} from "@/lib/controllers/controller-settings";

import { getLiveReadings } from "@/lib/data/iot";

export default async function ControllersPage({
  searchParams,
}: {
  searchParams: Promise<{
    lsind?: string;
    item?: string;
    sp?: string;
    stall?: string;
    ctrl?: string;
    module?: string;
  }>;
}) {
  const params = await searchParams;
  const { lsind, item, sp, stall, ctrl, module } = params;

  const [readings, history, commandThermoMap, user, alarmSettings] =
    await Promise.all([
      getLiveReadings(),
      getThermoCommandHistory(100),
      getThermoSettingsMap(500),
      getCurrentUser(),
      getAlarmSettings(),
    ]);

  const activeFarmKey = user ? resolveActiveFarmKey(user, params) : null;
  const adminAllFarms = Boolean(user?.isAdmin && !activeFarmKey);
  const alarms = deriveAlarmsFromReadings(readings, alarmSettings);
  const farmSummaries = adminAllFarms
    ? buildFarmSummaries(readings, alarms)
    : [];

  const liveThermoMap = buildThermoSettingsFromReadings(readings);
  const thermoSettings = mergeThermoSettingsMaps(commandThermoMap, liveThermoMap);

  return (
    <PageShell title="컨트롤러 제어" searchParams={{ lsind, item }}>
      <Suspense fallback={null}>
        <ControllersView
          readings={readings}
          initialLsind={lsind}
          initialItem={item}
          initialSp={sp}
          initialStall={stall}
          initialCtrl={ctrl}
          initialModule={module}
          canCommand={canCommand(user)}
          commands={history}
          thermoSettings={thermoSettings}
          isAdmin={user?.isAdmin ?? false}
          adminAllFarms={adminAllFarms}
          farmSummaries={farmSummaries}
        />
      </Suspense>
    </PageShell>
  );
}
