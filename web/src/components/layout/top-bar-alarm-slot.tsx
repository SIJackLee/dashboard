"use client";

import { AlarmBellMenu } from "@/components/layout/alarm-bell-menu";
import type { AlarmRow } from "@/lib/data/alarms";

export function TopBarAlarmSlot({ alarms }: { alarms: AlarmRow[] }) {
  return <AlarmBellMenu alarms={alarms} />;
}
