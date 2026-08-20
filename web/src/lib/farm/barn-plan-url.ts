import { normalizeStallTyCode } from "@/lib/data/stall-type";
import { barnSiteZoneKey } from "@/lib/farm/barn-site-types";

export const PLAN_BLDG_PARAM = "planBldg";
export const PLAN_SP_PARAM = "planSp";
export const PLAN_STALL_PARAM = "planStall";

export type BarnPlanFocus =
  | { level: "site" }
  | { level: "building"; buildingId: string }
  | {
      level: "zone";
      buildingId: string;
      stallTyCode: string;
      stallNo: string;
    };

export function clearBarnPlanParams(params: URLSearchParams): void {
  params.delete(PLAN_BLDG_PARAM);
  params.delete(PLAN_SP_PARAM);
  params.delete(PLAN_STALL_PARAM);
}

export function resolveBarnPlanFocus(params: URLSearchParams): BarnPlanFocus {
  const buildingId = params.get(PLAN_BLDG_PARAM)?.trim() ?? "";
  if (!buildingId) return { level: "site" };
  const stallTyCode = normalizeStallTyCode(params.get(PLAN_SP_PARAM));
  const stallNo = params.get(PLAN_STALL_PARAM)?.trim() ?? "";
  if (barnSiteZoneKey(stallTyCode, stallNo)) {
    return { level: "zone", buildingId, stallTyCode, stallNo };
  }
  return { level: "building", buildingId };
}

export function applyBarnPlanFocusParams(
  params: URLSearchParams,
  focus: BarnPlanFocus,
): void {
  clearBarnPlanParams(params);
  if (focus.level === "site") return;
  params.set(PLAN_BLDG_PARAM, focus.buildingId);
  if (focus.level === "building") return;
  params.set(PLAN_SP_PARAM, normalizeStallTyCode(focus.stallTyCode));
  params.set(PLAN_STALL_PARAM, focus.stallNo.trim());
}
