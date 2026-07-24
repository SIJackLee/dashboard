/** LIVE read tier + cache policy (D9 / perf plan) */

export type LiveReadTier = "list" | "legacy";

/** `legacy` rolls back to v_iot_decoded_latest + decoded_json.
 *  Note: farm-scoped fetches always use decoded_latest (need channels[] for bulk).
 */
export function liveReadTier(): LiveReadTier {
  const raw = process.env.NEXT_PUBLIC_LIVE_READ_TIER?.trim().toLowerCase();
  return raw === "legacy" ? "legacy" : "list";
}

export const LIVE_CACHE_REVALIDATE_SECONDS = 300;

export { LIVE_FARM_ROW_LIMIT } from "@/lib/admin/health/constants";

export const LIVE_CACHE_TAG = "live";

export function liveCacheTagForFarm(farmScopeKey: string): string {
  return `${LIVE_CACHE_TAG}:${farmScopeKey}`;
}

export function farmScopeCacheKey(
  lsindRegistNo: string | null,
  itemCode: string | null,
): string {
  if (lsindRegistNo && itemCode) return `${lsindRegistNo}/${itemCode}`;
  return "global";
}
