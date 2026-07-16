import {
  getViewportPreviewMode,
  isViewportCompact,
  VIEWPORT_MOBILE_MEDIA_QUERY,
} from "@/lib/ui/viewport-preview-store";

/** ViewportPreview(mobile) 또는 실제 좁은 화면 — JS 레이아웃 분기용 */
export function isMobileLayoutActive(): boolean {
  if (typeof window === "undefined") return false;
  if (isViewportCompact(getViewportPreviewMode())) return true;
  return window.matchMedia(VIEWPORT_MOBILE_MEDIA_QUERY).matches;
}
