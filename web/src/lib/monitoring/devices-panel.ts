import type { FarmKey } from "@/lib/data/farm-key";
import { appendFarmKeyParams } from "@/lib/data/farm-key";

export type DevicesPanelId = "control" | "alarm" | "display" | "farm";

const PANEL_META: Record<
  DevicesPanelId,
  { label: string; adminOnly?: boolean; operatorOnly?: boolean }
> = {
  control: { label: "컨트롤러" },
  alarm: { label: "알람" },
  display: { label: "표시", operatorOnly: true },
  farm: { label: "농장", operatorOnly: true },
};

export function getVisibleDevicesPanels(isAdmin: boolean): DevicesPanelId[] {
  return (Object.keys(PANEL_META) as DevicesPanelId[]).filter((id) => {
    if (id === "alarm" || id === "control") return false;
    const meta = PANEL_META[id];
    if (meta.adminOnly && !isAdmin) return false;
    if (meta.operatorOnly && isAdmin) return false;
    return true;
  });
}

export function getDevicesPanelLabel(id: DevicesPanelId): string {
  return PANEL_META[id].label;
}

export function parseDevicesPanel(
  panel: string | null | undefined,
  isAdmin = false
): DevicesPanelId {
  const visible = getVisibleDevicesPanels(isAdmin);
  if (panel === "alarm") return "control";
  if (panel && visible.includes(panel as DevicesPanelId)) {
    return panel as DevicesPanelId;
  }
  return "control";
}

export function setDevicesPanelParam(
  params: URLSearchParams,
  panel: DevicesPanelId
): void {
  if (panel === "control") params.delete("panel");
  else params.set("panel", panel);
}

function buildDevicesPanelSearch(
  panel: DevicesPanelId,
  params?: URLSearchParams | Record<string, string | undefined | null>,
  farmKey?: FarmKey
): URLSearchParams {
  const search = new URLSearchParams();
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => {
      if (value) search.set(key, value);
    });
  } else if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
  }
  if (farmKey) appendFarmKeyParams(search, farmKey);
  search.set("tab", "ops");
  setDevicesPanelParam(search, panel);
  return search;
}

export function devicesPanelHref(
  panel: DevicesPanelId = "control",
  params?: URLSearchParams | Record<string, string | undefined | null>,
  farmKey?: FarmKey
): string {
  const search = buildDevicesPanelSearch(panel, params, farmKey);
  const q = search.toString();
  return q ? `/farm?${q}` : "/farm?tab=ops";
}

export function devicesAlarmSettingsHref(
  params?: URLSearchParams | Record<string, string | undefined | null>
): string {
  return devicesPanelHref("control", params);
}

export function devicesDisplayPanelHref(
  params?: URLSearchParams | Record<string, string | undefined | null>
): string {
  return devicesPanelHref("display", params);
}

export function devicesFarmPanelHref(
  farmKey?: FarmKey,
  params?: URLSearchParams | Record<string, string | undefined | null>
): string {
  return devicesPanelHref("farm", params, farmKey);
}
