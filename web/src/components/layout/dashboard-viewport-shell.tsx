"use client";

import { useRef } from "react";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { DashboardViewportProvider } from "@/components/layout/dashboard-viewport-context";
import { useContainerCompact } from "@/lib/ui/use-container-compact";
import { cn } from "@/lib/utils";

type Role = "admin" | "operator" | "viewer";

type Props = {
  children: React.ReactNode;
  role: Role | null;
};

/** 패널/창 실제 너비 기준 compact 레이아웃 + 하단 네비 */
export function DashboardViewportShell({ children, role }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const compact = useContainerCompact(rootRef);

  return (
    <DashboardViewportProvider compact={compact}>
      <div
        ref={rootRef}
        data-dashboard-compact={compact || undefined}
        className="flex h-screen min-w-0 flex-col overflow-hidden"
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col",
            compact && "pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
          )}
        >
          {children}
        </div>
        {compact ? <MobileBottomNav role={role} /> : null}
      </div>
    </DashboardViewportProvider>
  );
}
