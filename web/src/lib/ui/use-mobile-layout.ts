"use client";

import { useSyncExternalStore } from "react";
import { isMobileLayoutActive } from "@/lib/ui/mobile-layout";
import {
  subscribeViewportPreview,
  VIEWPORT_MOBILE_MEDIA_QUERY,
} from "@/lib/ui/viewport-preview-store";

function subscribeMobileLayout(onStoreChange: () => void): () => void {
  const mq = window.matchMedia(VIEWPORT_MOBILE_MEDIA_QUERY);
  const onMq = () => onStoreChange();
  mq.addEventListener("change", onMq);
  const unsubPreview = subscribeViewportPreview(onStoreChange);
  return () => {
    mq.removeEventListener("change", onMq);
    unsubPreview();
  };
}

/** Tailwind `md` 미만 또는 모바일 뷰 토글 — 모바일 전용 레이아웃 */
export function useMobileLayout(): boolean {
  return useSyncExternalStore(
    subscribeMobileLayout,
    isMobileLayoutActive,
    () => false,
  );
}
