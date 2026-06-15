"use client";

import { useEffect, useMemo, useState } from "react";
import { DisplaySettingsForm } from "./display-settings-form";
import { FarmLocationForm } from "./farm-location-form";
import { PiggyPlayerIdForm } from "./piggy-player-id-form";
import { AlarmThresholdForm } from "./alarm-threshold-form";
import { SettingsTabNav, type SettingsTabId } from "./settings-tab-nav";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { DisplaySettings } from "@/lib/data/display-settings-shared";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import type { StallCatalogEntry } from "@/lib/data/stall-catalog";
import type { BarnReading } from "@/lib/data/iot";
import { getVisibleSettingsTabIds } from "@/lib/dashboard-sections";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { PIGGY_PLAY_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

type Props = {
  stallCatalog: StallCatalogEntry[];
  readings: BarnReading[];
  alarmSettings: AlarmSettings;
  displaySettings: DisplaySettings;
  alarmNotice?: { tone: "ok" | "error"; text: string } | null;
  displayNotice?: { tone: "ok" | "error"; text: string } | null;
  farmNotice?: { tone: "ok" | "error"; text: string } | null;
  farmLocationOptions?: EditableFarmOption[];
  piggyPlayerId?: string;
  initialTab?: SettingsTabId;
};

export function SettingsView({
  stallCatalog,
  readings,
  alarmSettings,
  displaySettings,
  alarmNotice,
  displayNotice,
  farmNotice,
  farmLocationOptions = [],
  piggyPlayerId = "",
  initialTab = "dashboard",
}: Props) {
  const visibleTabs = useMemo(() => getVisibleSettingsTabIds(), []);
  const [tab, setTab] = useState<SettingsTabId>(() =>
    visibleTabs.includes(initialTab) ? initialTab : visibleTabs[0] ?? "dashboard"
  );

  useEffect(() => {
    if (!visibleTabs.includes(tab)) {
      setTab(visibleTabs[0] ?? "dashboard");
    }
  }, [tab, visibleTabs]);

  return (
    <>
      <SettingsTabNav active={tab} onChange={setTab} />
      <div className="space-y-6">
        {tab === "dashboard" && (
          <>
            {PIGGY_PLAY_ENABLED ? (
              <PiggyPlayerIdForm
                initialPlayerId={piggyPlayerId}
                notice={displayNotice}
              />
            ) : null}
            <DisplaySettingsForm
              initialSettings={displaySettings}
              notice={PIGGY_PLAY_ENABLED ? null : displayNotice}
            />
          </>
        )}
        {tab === "farm" && (
          <FarmLocationForm
            options={farmLocationOptions}
            notice={farmNotice}
          />
        )}
        {tab === "alarm" && (
          <AlarmThresholdForm
            initialSettings={alarmSettings}
            stallCatalog={stallCatalog}
            readings={readings}
            notice={alarmNotice}
          />
        )}
      </div>
    </>
  );
}
