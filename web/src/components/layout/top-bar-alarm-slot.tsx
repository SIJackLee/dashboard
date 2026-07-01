"use client";

import { AlarmBellMenu } from "@/components/layout/alarm-bell-menu";
import type { AlarmRow } from "@/lib/data/alarms";

import type { WeatherWarningRow } from "@/lib/data/weather-warnings";

export function TopBarAlarmSlot({
  alarms,
  weatherWarnings = [],
}: {
  alarms: AlarmRow[];
  weatherWarnings?: WeatherWarningRow[];
}) {
  return (
    <AlarmBellMenu alarms={alarms} weatherWarnings={weatherWarnings} />
  );
}
