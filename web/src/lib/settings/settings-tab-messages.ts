import type { SettingsTabId } from "@/components/settings/settings-tab-nav";

const SETTINGS_TAB_LOADING_MESSAGES: Record<SettingsTabId, string> = {
  dashboard: "표시 설정으로 이동 중…",
  farm: "농장 설정으로 이동 중…",
  alarm: "알람 설정으로 이동 중…",
};

export function settingsTabLoadingMessage(tab: SettingsTabId): string {
  return SETTINGS_TAB_LOADING_MESSAGES[tab];
}
