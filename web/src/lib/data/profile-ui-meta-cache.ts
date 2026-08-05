import "server-only";

import { revalidateTag } from "next/cache";

/** profiles.ui_config 읽기 캐시 (layout prefs · alarm settings). 권한(user_access)은 포함하지 않음. */
export const PROFILE_UI_META_TAG = "profile-ui-meta";
export const PROFILE_UI_META_REVALIDATE_SECONDS = 60;

export function revalidateProfileUiMetaCache(userId?: string): void {
  revalidateTag(PROFILE_UI_META_TAG, "max");
  if (userId) {
    revalidateTag(`${PROFILE_UI_META_TAG}:${userId}`, "max");
  }
}
