import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import {
  LIVE_CACHE_REVALIDATE_SECONDS,
  LIVE_CACHE_TAG,
  liveCacheTagForFarm,
} from "@/lib/data/live-config";

export function revalidateLiveCache(farmScopeKey?: string): void {
  revalidateTag(LIVE_CACHE_TAG, "max");
  if (farmScopeKey) {
    revalidateTag(liveCacheTagForFarm(farmScopeKey), "max");
  }
}

export function cachedLiveQuery<T>(
  keyParts: string[],
  tags: string[],
  fn: () => Promise<T>,
): Promise<T> {
  return unstable_cache(fn, keyParts, {
    revalidate: LIVE_CACHE_REVALIDATE_SECONDS,
    tags: [LIVE_CACHE_TAG, ...tags],
  })();
}
