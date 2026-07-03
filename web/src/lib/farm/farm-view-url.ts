import { normalizeStallTyCode } from "@/lib/data/stall-type";

export type FarmMapDrillLevel = "sp" | "stalls";

/** 목록 탭 — 카드 그리드 전역 보기 모드 */
export type BarnListViewMode = "controller" | "graph" | "settings" | "channel";

const LIST_VIEW_MODES: BarnListViewMode[] = [
  "controller",
  "graph",
  "settings",
  "channel",
];

export function parseListViewMode(
  raw: string | null | undefined
): BarnListViewMode {
  if (raw && LIST_VIEW_MODES.includes(raw as BarnListViewMode)) {
    return raw as BarnListViewMode;
  }
  return "controller";
}

export function setListViewMode(
  params: URLSearchParams,
  mode: BarnListViewMode
): void {
  if (mode === "controller") params.delete("listMode");
  else params.set("listMode", mode);
}

/** 목록 탭 전용 — view=list 유지, map drill(stall/mapLevel)만 제거 */
export function applyListViewParams(params: URLSearchParams): void {
  params.set("view", "list");
  params.delete("stall");
  params.delete("mapLevel");
}

/** 지도 탭 — 그리드 진입(드릴 쿼리 제거) */
export function applyMapGridParams(params: URLSearchParams): void {
  params.delete("view");
  params.delete("listMode");
  clearMapDrillParams(params);
}

export function clearMapDrillParams(params: URLSearchParams): void {
  params.delete("sp");
  params.delete("stall");
  params.delete("mapLevel");
}

/** 축사유형 카드 → SP 그래프 */
export function setMapGraphSp(params: URLSearchParams, stallTyCode: string): void {
  params.delete("view");
  params.set("sp", normalizeStallTyCode(stallTyCode));
  params.delete("mapLevel");
  params.delete("stall");
}

export function setMapDrillLevel(
  params: URLSearchParams,
  level: FarmMapDrillLevel
): void {
  if (level === "stalls") params.set("mapLevel", "stalls");
  else params.delete("mapLevel");
  params.delete("stall");
}

export function setMapControllerStall(
  params: URLSearchParams,
  stallNo: string
): void {
  params.set("stall", stallNo.trim());
}

export function clearMapControllerStall(params: URLSearchParams): void {
  params.delete("stall");
}

export function buildFarmPath(params: URLSearchParams): string {
  const q = params.toString();
  return q ? `/farm?${q}` : "/farm";
}

/** tab=ops 유지하며 view=list|map 전환 */
export function applyHubScopedViewParams(
  params: URLSearchParams,
  view: "map" | "list"
): void {
  params.set("tab", "ops");
  if (view === "list") applyListViewParams(params);
  else applyMapGridParams(params);
}

/** Admin hub scoped farm path — tab=ops 유지 */
export function buildHubScopedFarmPath(params: URLSearchParams): string {
  params.set("tab", "ops");
  return buildFarmPath(params);
}

/** hub farm 선택 시 in-grid drill + view 탭 초기화 */
export function clearHubFarmDrillParams(params: URLSearchParams): void {
  clearMapDrillParams(params);
  params.delete("view");
  params.delete("listMode");
  params.delete("ctrl");
  params.delete("alarm");
}

/** in-grid drill — router.replace 없이 URL만 갱신 (그리드 깜빡임 방지) */
export function replaceFarmUrlShallow(params: URLSearchParams): void {
  if (typeof window === "undefined") return;
  const path = buildFarmPath(params);
  window.history.replaceState(window.history.state, "", path);
}

/** shallow drill 후 useSearchParams와 동기화되지 않을 때 현재 URL 기준 */
export function currentFarmSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function parseMapDrillLevel(
  raw: string | null | undefined
): FarmMapDrillLevel {
  return raw === "stalls" ? "stalls" : "sp";
}
