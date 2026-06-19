export type MonitoringTabId = "map" | "ops";

export const MONITORING_TABS: ReadonlyArray<{
  id: MonitoringTabId;
  label: string;
}> = [
  { id: "map", label: "현황" },
  { id: "ops", label: "컨트롤러" },
];

export const MONITORING_BASE_PATH = "/farm";

/** 레거시 tab=devices|alarms → ops */
export function parseMonitoringTab(
  tab: string | null | undefined
): MonitoringTabId {
  if (tab === "ops" || tab === "devices" || tab === "alarms") return "ops";
  return "map";
}

/** tab=map 은 query 생략 (기본) */
export function setMonitoringTabParam(
  params: URLSearchParams,
  tab: MonitoringTabId
): void {
  if (tab === "map") params.delete("tab");
  else params.set("tab", tab);
}

/**
 * 탭 전환 시 다른 탭 전용 query 제거.
 * Admin 전국 현황(map, lsind/item 없음)은 scope 파라미터까지 정리해 geo 지도로 고정.
 */
export function sanitizeMonitoringSearchParams(
  params: URLSearchParams,
  nextTab: MonitoringTabId
): void {
  setMonitoringTabParam(params, nextTab);

  if (nextTab === "map") {
    params.delete("alarm");
    params.delete("ctrl");
    params.delete("module");
    params.delete("stall");
    params.delete("panel");

    const hasFarmScope = params.has("lsind") && params.has("item");
    if (!hasFarmScope) {
      params.delete("lsind");
      params.delete("item");
      params.delete("sp");
      params.delete("view");
    }
    return;
  }

  if (nextTab === "ops") {
    params.delete("view");
  }
}

export function monitoringHref(
  tab: MonitoringTabId = "map",
  params?: URLSearchParams | Record<string, string | undefined | null>
): string {
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
  setMonitoringTabParam(search, tab);
  const q = search.toString();
  return q ? `${MONITORING_BASE_PATH}?${q}` : MONITORING_BASE_PATH;
}
