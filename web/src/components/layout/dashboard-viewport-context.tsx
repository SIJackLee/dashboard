"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import {
  getViewportPreviewMode,
  isViewportCompact,
  subscribeViewportPreview,
} from "@/lib/ui/viewport-preview-store";

const DashboardViewportContext = createContext(false);

export function DashboardViewportProvider({
  compact,
  children,
}: {
  compact: boolean;
  children: React.ReactNode;
}) {
  return (
    <DashboardViewportContext.Provider value={compact}>
      {children}
    </DashboardViewportContext.Provider>
  );
}

/** DashboardViewportShell의 compact 여부 (토글 기준) */
export function useDashboardCompact() {
  return useContext(DashboardViewportContext);
}

/**
 * compact 레이아웃 여부 — 접속 기기 자동 감지(auto) 또는 수동 토글(mobile|desktop)과 동기화.
 * SSR·첫 hydration은 desktop.
 */
export function useHydrationSafeDashboardCompact(): boolean {
  const mode = useSyncExternalStore(
    subscribeViewportPreview,
    getViewportPreviewMode,
    () => "desktop" as const,
  );
  return isViewportCompact(mode);
}
