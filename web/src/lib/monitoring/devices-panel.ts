import type { FarmKey } from "@/lib/data/farm-key";

import { appendFarmKeyParams } from "@/lib/data/farm-key";

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

/** 레거시 `panel` query 제거 — 컨트롤러 ops(`/farm?tab=ops`)로 통합 */
export function setDevicesPanelParam(params: URLSearchParams): void {
  params.delete("panel");
}

export function devicesPanelHref(
  params?: URLSearchParams | Record<string, string | undefined | null>,
  farmKey?: FarmKey
): string {
  const search = buildDevicesPanelSearch(params, farmKey);
  const q = search.toString();
  return q ? `/farm?${q}` : "/farm?tab=ops";
}

export function devicesAlarmSettingsHref(
  params?: URLSearchParams | Record<string, string | undefined | null>,
  farmKey?: FarmKey
): string {
  return devicesPanelHref(params, farmKey);
}
