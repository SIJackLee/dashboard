"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { NavigationLoadingOverlay } from "@/components/common/navigation-loading-overlay";
import { DisplaySettingsForm } from "./display-settings-form";
import { FarmLocationForm } from "./farm-location-form";
import { PiggyPlayerIdForm } from "./piggy-player-id-form";
import { SettingsTabNav, type SettingsTabId } from "./settings-tab-nav";
import { SettingsTabPanelSkeleton } from "./settings-tab-panel-skeleton";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { DisplaySettings } from "@/lib/data/display-settings-shared";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import { parseFarmKeyFromQuery, type FarmKey } from "@/lib/data/farm-key";
import type { StallCatalogEntry } from "@/lib/data/stall-catalog";
import type { BarnReading } from "@/lib/data/iot";
import { getVisibleSettingsTabIds, resolveSettingsTab } from "@/lib/dashboard-sections";
import { NAV_MIN_DISPLAY_MS } from "@/lib/navigation/nav-utils";
import { settingsTabLoadingMessage } from "@/lib/settings/settings-tab-messages";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { PIGGY_PLAY_ENABLED } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

const AdminFarmLocationPanel = dynamic(
  () =>
    import("@/components/settings/admin-farm-location-panel").then(
      (m) => m.AdminFarmLocationPanel
    ),
  {
    ssr: false,
    loading: () => (
      <SettingsTabPanelSkeleton message="농장 설정 불러오는 중…" />
    ),
  }
);

const AlarmThresholdForm = dynamic(
  () =>
    import("@/components/settings/alarm-threshold-form").then(
      (m) => m.AlarmThresholdForm
    ),
  {
    loading: () => (
      <SettingsTabPanelSkeleton message="알람 설정 불러오는 중…" />
    ),
  }
);

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
  isAdmin?: boolean;
  initialFarmKey?: FarmKey | null;
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
  isAdmin = false,
  initialFarmKey = null,
}: Props) {
  const searchParams = useSearchParams();
  const visibleTabs = useMemo(() => getVisibleSettingsTabIds(), []);

  const tabFromUrl = resolveSettingsTab(
    searchParams.get("tab") ?? initialTab
  );

  const [tab, setTab] = useState<SettingsTabId>(() =>
    visibleTabs.includes(tabFromUrl) ? tabFromUrl : visibleTabs[0] ?? "dashboard"
  );
  const [tabPending, startTabTransition] = useTransition();
  const [tabOverlay, setTabOverlay] = useState<{
    message: string;
    tab: SettingsTabId;
  } | null>(null);
  const tabSwitchStartedAtRef = useRef(0);

  useEffect(() => {
    const next = resolveSettingsTab(searchParams.get("tab") ?? undefined);
    if (visibleTabs.includes(next) && next !== tab) {
      setTab(next);
    }
  }, [searchParams, visibleTabs, tab]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const next = resolveSettingsTab(params.get("tab") ?? undefined);
      if (visibleTabs.includes(next)) {
        setTab(next);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [visibleTabs]);

  useEffect(() => {
    if (tabPending || !tabOverlay) return;

    const elapsed = Date.now() - tabSwitchStartedAtRef.current;
    const remaining = Math.max(0, NAV_MIN_DISPLAY_MS - elapsed);
    const timer = window.setTimeout(() => setTabOverlay(null), remaining);
    return () => window.clearTimeout(timer);
  }, [tabPending, tabOverlay]);

  const activeTab = visibleTabs.includes(tab)
    ? tab
    : visibleTabs[0] ?? "dashboard";

  const farmKeyFromUrl = parseFarmKeyFromQuery(
    searchParams.get("lsind"),
    searchParams.get("item")
  );

  const handleTabChange = (id: SettingsTabId) => {
    if (id === activeTab || tabPending) return;

    tabSwitchStartedAtRef.current = Date.now();
    setTabOverlay({ message: settingsTabLoadingMessage(id), tab: id });

    startTabTransition(() => {
      setTab(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", id);
      params.delete("ok");
      params.delete("error");
      window.history.replaceState(null, "", `/settings?${params.toString()}`);
    });
  };

  return (
    <>
      <SettingsTabNav
        active={activeTab}
        onChange={handleTabChange}
        pending={tabPending}
        pendingTab={tabOverlay?.tab ?? null}
      />

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
        {activeTab === "farm" &&
          (isAdmin ? (
            <AdminFarmLocationPanel
              options={farmLocationOptions}
              initialFarmKey={farmKeyFromUrl ?? initialFarmKey}
            />
          ) : (
            <FarmLocationForm options={farmLocationOptions} />
          ))}
        {activeTab === "alarm" && (
          <AlarmThresholdForm
            initialSettings={alarmSettings}
            readings={readings}
          />
        )}
      </div>

      {tabOverlay ? (
        <NavigationLoadingOverlay message={tabOverlay.message} />
      ) : null}
    </>
  );
}
