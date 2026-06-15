"use client";

import { DisplayGate } from "@/components/display/display-settings-provider";
import { AlarmBellMenu } from "@/components/layout/alarm-bell-menu";
import type { AlarmRow } from "@/lib/data/alarms";

export function TopBarAlarmSlot({ alarms }: { alarms: AlarmRow[] }) {
  return (
    <DisplayGate setting="global.topBarBell">
      <AlarmBellMenu alarms={alarms} />
    </DisplayGate>
  );
}
