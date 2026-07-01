"use client";

import { createContext, useContext } from "react";

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

/** DashboardViewportShell의 실제 패널 너비 기준 compact 여부 */
export function useDashboardCompact() {
  return useContext(DashboardViewportContext);
}
