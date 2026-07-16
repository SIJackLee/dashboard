"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Monitor, Smartphone } from "lucide-react";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import {
  getViewportPreviewMode,
  setViewportPreviewMode,
  subscribeViewportPreview,
  syncViewportPreviewToDocument,
  type ViewportPreviewMode,
} from "@/lib/ui/viewport-preview-store";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<ViewportPreviewMode, string> = {
  mobile: "모바일 레이아웃",
  desktop: "PC 레이아웃",
};

/** 모바일 ↔ PC 레이아웃 강제 (브라우저 너비 무관) */
export function MobileViewPreviewToggle() {
  const mode = useSyncExternalStore(
    subscribeViewportPreview,
    getViewportPreviewMode,
    () => "desktop" as ViewportPreviewMode,
  );

  useEffect(() => {
    syncViewportPreviewToDocument(mode);
  }, [mode]);

  const isMobile = mode === "mobile";
  const Icon = isMobile ? Monitor : Smartphone;
  const next: ViewportPreviewMode = isMobile ? "desktop" : "mobile";

  return (
    <button
      type="button"
      className={cn(
        dashboardUi.topHeaderActionBtn,
        isMobile && "border-primary/60 bg-primary/5 text-primary",
      )}
      aria-label={`${MODE_LABEL[mode]}. 클릭하여 ${MODE_LABEL[next]}(으)로 전환`}
      aria-pressed={isMobile}
      title={`${MODE_LABEL[mode]} → ${MODE_LABEL[next]}`}
      data-tour-id="viewport-preview-toggle"
      onClick={() => setViewportPreviewMode(next)}
    >
      <Icon className="size-4 md:size-5" aria-hidden />
      <span className="sr-only">{MODE_LABEL[mode]}</span>
    </button>
  );
}
