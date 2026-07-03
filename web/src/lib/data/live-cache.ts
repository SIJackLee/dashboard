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

type CachedLiveQueryOptions<T> = {
  /** false면 unstable_cache 저장 생략 (empty/error transient 회복) */
  shouldCache?: (result: T) => boolean;
};

export async function cachedLiveQuery<T>(
  keyParts: string[],
  tags: string[],
  fn: () => Promise<T>,
  options?: CachedLiveQueryOptions<T>,
): Promise<T> {
  const shouldCache = options?.shouldCache ?? (() => true);

  if (options?.shouldCache) {
    const fresh = await fn();
    if (!shouldCache(fresh)) {
      return fresh;
    }
    return unstable_cache(() => Promise.resolve(fresh), keyParts, {
      revalidate: LIVE_CACHE_REVALIDATE_SECONDS,
      tags: [LIVE_CACHE_TAG, ...tags],
    })();
  }

  return unstable_cache(fn, keyParts, {
    revalidate: LIVE_CACHE_REVALIDATE_SECONDS,
    tags: [LIVE_CACHE_TAG, ...tags],
  })();
}
