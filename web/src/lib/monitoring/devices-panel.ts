import type { FarmKey } from "@/lib/data/farm-key";
import { appendFarmKeyParams } from "@/lib/data/farm-key";

/** @deprecated farm panel removed — 농장 주소는 계정 메뉴에서 설정 */
export type DevicesPanelId = "control" | "farm";

const PANEL_META: Record<DevicesPanelId, { label: string }> = {
  control: { label: "컨트롤러" },
  farm: { label: "농장" },
};

/** 컨트롤러 ops만 표시 — 서브 탭 nav 없음 */
export function getVisibleDevicesPanels(_isAdmin = false): DevicesPanelId[] {
  return ["control"];
}

export function getDevicesPanelLabel(id: DevicesPanelId): string {
  return PANEL_META[id].label;
}

export function parseDevicesPanel(
  _panel: string | null | undefined,
  _isAdmin = false
): DevicesPanelId {
  return "control";
}

export function setDevicesPanelParam(
  params: URLSearchParams,
  _panel: DevicesPanelId
): void {
  params.delete("panel");
}

function buildDevicesPanelSearch(
  params?: URLSearchParams | Record<string, string | undefined | null>,
  farmKey?: FarmKey
): URLSearchParams {
  const search = new URLSearchParams();
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => {
      if (key === "panel") return;
      if (value) search.set(key, value);
    });
  } else if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (key === "panel") continue;
      if (value) search.set(key, value);
    }
  }
  if (farmKey) appendFarmKeyParams(search, farmKey);
  search.set("tab", "ops");
  return search;
}

export function devicesPanelHref(
  _panel: DevicesPanelId = "control",
  params?: URLSearchParams | Record<string, string | undefined | null>,
  farmKey?: FarmKey
): string {
  const search = buildDevicesPanelSearch(params, farmKey);
  const q = search.toString();
  return q ? `/farm?${q}` : "/farm?tab=ops";
}

export function devicesAlarmSettingsHref(
  params?: URLSearchParams | Record<string, string | undefined | null>
): string {
  return devicesPanelHref("control", params);
}

/** @deprecated — /farm?tab=ops 로 통합 */
export function devicesFarmPanelHref(
  farmKey?: FarmKey,
  params?: URLSearchParams | Record<string, string | undefined | null>
): string {
  return devicesPanelHref("control", params, farmKey);
}
