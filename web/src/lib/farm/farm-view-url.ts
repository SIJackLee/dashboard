import {
  DEFAULT_TREND_PERIOD,
  TREND_PERIODS,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { normalizeStallTyCode } from "@/lib/data/stall-type";

export const TREND_PERIOD_PARAM = "trendPeriod";

export function parseTrendPeriodParam(
  raw: string | null | undefined,
): TrendPeriodId {
  if (raw === "24h" || raw === "7d" || raw === "30d") return raw;
  return DEFAULT_TREND_PERIOD;
}

export function resolveTrendPeriodParam(params: URLSearchParams): TrendPeriodId {
  return parseTrendPeriodParam(params.get(TREND_PERIOD_PARAM));
}

/** 기본 period(24h)면 URL에서 생략. */
export function setTrendPeriodParam(
  params: URLSearchParams,
  period: TrendPeriodId,
): void {
  if (period === DEFAULT_TREND_PERIOD) params.delete(TREND_PERIOD_PARAM);
  else params.set(TREND_PERIOD_PARAM, period);
}

export function trendPeriodLabel(period: TrendPeriodId): string {
  return TREND_PERIODS[period].label;
}

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
  if (raw === "channel") return "graph";
  if (raw && LIST_VIEW_MODES.includes(raw as BarnListViewMode)) {
    return raw as BarnListViewMode;
  }
  return "controller";
}

/** hub shallow URL · searchParams 공통 — URL listMode 우선 */
export function resolveListViewMode(
  params: URLSearchParams,
  fallback?: BarnListViewMode
): BarnListViewMode {
  const raw = params.get("listMode");
  if (raw) return parseListViewMode(raw);
  return fallback ?? "controller";
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

/** view=list|map 전환 (레거시 tab=ops 쿼리 제거) */
export function applyHubScopedViewParams(
  params: URLSearchParams,
  view: "map" | "list"
): void {
  params.delete("tab");
  if (view === "list") applyListViewParams(params);
  else applyMapGridParams(params);
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

/** 목록 탭 — flat(기본) / group(그룹별) */
export type ListLayout = "group" | "flat";

export function resolveListLayoutParam(params: URLSearchParams): ListLayout {
  return params.get("listLayout") === "group" ? "group" : "flat";
}
