import type { SettingsTabId } from "@/components/settings/settings-tab-nav";
import { PIGGY_PLAY_ENABLED } from "@/lib/feature-flags";
import type { DisplaySettingKey } from "@/lib/data/display-settings-shared";

/** 사이드바에 노출되는 앱 섹션 (설정 /admin 제외) */
export const APP_NAV_SECTIONS = [
  {
    href: "/farm",
    label: "농장",
    settingsTab: "farm" as const satisfies SettingsTabId,
    displayPageId: "farm" as const,
  },
  {
    href: "/controllers",
    label: "컨트롤러",
    settingsTab: null,
    displayPageId: "controller" as const,
  },
  {
    href: "/alarms",
    label: "알람",
    settingsTab: "alarm" as const satisfies SettingsTabId,
    displayPageId: "alarm" as const,
  },
  {
    href: "/play",
    label: "오락",
    settingsTab: null,
    displayPageId: null,
    requiresPiggy: true,
  },
] as const;

export type AppNavSection = (typeof APP_NAV_SECTIONS)[number];

export type DashboardNavOptions = {
  piggyEnabled?: boolean;
};

/** 사이드바·설정 탭 동기화용 활성 경로 */
export function getActiveAppNavHrefs(
  options: DashboardNavOptions = {}
): Set<string> {
  const piggy = options.piggyEnabled ?? PIGGY_PLAY_ENABLED;
  const hrefs = new Set<string>();
  for (const section of APP_NAV_SECTIONS) {
    if ("requiresPiggy" in section && section.requiresPiggy && !piggy) {
      continue;
    }
    hrefs.add(section.href);
  }
  return hrefs;
}

/** 설정 페이지 탭 — 표시 + 활성 앱 섹션에 대응하는 탭만 */
export function getVisibleSettingsTabIds(
  options: DashboardNavOptions = {}
): SettingsTabId[] {
  const active = getActiveAppNavHrefs(options);
  const tabs: SettingsTabId[] = ["dashboard"];

  for (const section of APP_NAV_SECTIONS) {
    if (!section.settingsTab) continue;
    if (active.has(section.href)) {
      tabs.push(section.settingsTab);
    }
  }

  return tabs;
}

/** 표시 설정 그룹 pageId — 활성 페이지만 */
export function getVisibleDisplayPageIds(
  options: DashboardNavOptions = {}
): Set<string> {
  const active = getActiveAppNavHrefs(options);
  const ids = new Set<string>(["global"]);
  for (const section of APP_NAV_SECTIONS) {
    if (section.displayPageId && active.has(section.href)) {
      ids.add(section.displayPageId);
    }
  }
  return ids;
}

export function isSettingsTabVisible(
  tab: SettingsTabId,
  options: DashboardNavOptions = {}
): boolean {
  return getVisibleSettingsTabIds(options).includes(tab);
}

export function resolveSettingsTab(
  tab: string | undefined,
  options: DashboardNavOptions = {}
): SettingsTabId {
  const visible = getVisibleSettingsTabIds(options);
  if (tab && visible.includes(tab as SettingsTabId)) {
    return tab as SettingsTabId;
  }
  return visible[0] ?? "dashboard";
}

/** 표시 설정 키 prefix → pageId */
export function displayKeyPageId(key: DisplaySettingKey): string {
  return key.split(".")[0] ?? "global";
}
