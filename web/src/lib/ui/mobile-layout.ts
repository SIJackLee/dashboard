import {
  getViewportPreviewMode,
  isViewportCompact,
} from "@/lib/ui/viewport-preview-store";

/** ViewportPreview 토글(mobile) 또는 실제 좁은 화면 — JS 레이아웃 분기용 */
export function isMobileLayoutActive(): boolean {
  if (typeof window === "undefined") return false;
  if (isViewportCompact(getViewportPreviewMode())) return true;
  return window.matchMedia("(max-width: 767px)").matches;
}
