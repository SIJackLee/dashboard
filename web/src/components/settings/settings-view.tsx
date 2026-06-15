"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { getVisibleSettingsTabIds, resolveSettingsTab } from "@/lib/dashboard-sections";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { PIGGY_PLAY_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

export type SettingsNotice = { tone: "ok" | "error"; text: string };

type Props = {
  stallCatalog: StallCatalogEntry[];
  readings: BarnReading[];
  alarmSettings: AlarmSettings;
  displaySettings: DisplaySettings;
  notice?: SettingsNotice | null;
  farmLocationOptions?: EditableFarmOption[];
  piggyPlayerId?: string;
  initialTab?: SettingsTabId;
};

export function SettingsView({
  stallCatalog,
  readings,
  alarmSettings,
  displaySettings,
  notice,
  farmLocationOptions = [],
  piggyPlayerId = "",
  initialTab = "dashboard",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const visibleTabs = useMemo(() => getVisibleSettingsTabIds(), []);

  const tabFromUrl = resolveSettingsTab(
    searchParams.get("tab") ?? initialTab
  );

  const [tab, setTab] = useState<SettingsTabId>(() =>
    visibleTabs.includes(tabFromUrl) ? tabFromUrl : visibleTabs[0] ?? "dashboard"
  );

  useEffect(() => {
    const next = resolveSettingsTab(searchParams.get("tab") ?? undefined);
    if (visibleTabs.includes(next) && next !== tab) {
      setTab(next);
    }
  }, [searchParams, visibleTabs, tab]);

  const activeTab = visibleTabs.includes(tab)
    ? tab
    : visibleTabs[0] ?? "dashboard";

  const handleTabChange = (id: SettingsTabId) => {
    setTab(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", id);
    params.delete("ok");
    params.delete("error");
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      <SettingsTabNav active={activeTab} onChange={handleTabChange} />

      {notice ? (
        <p
          className={cn(
            "rounded-xl border px-5 py-4",
            dashboardUi.body,
            notice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="space-y-6">
        {activeTab === "dashboard" && (
          <>
            {PIGGY_PLAY_ENABLED ? (
              <PiggyPlayerIdForm initialPlayerId={piggyPlayerId} />
            ) : null}
            <DisplaySettingsForm initialSettings={displaySettings} />
          </>
        )}
        {activeTab === "farm" && (
          <FarmLocationForm options={farmLocationOptions} />
        )}
        {activeTab === "alarm" && (
          <AlarmThresholdForm
            initialSettings={alarmSettings}
            stallCatalog={stallCatalog}
            readings={readings}
          />
        )}
      </div>
    </>
  );
}
