"use client";

import { SoftRefreshProgress } from "@/components/common/soft-refresh-progress";
import { cn } from "@/lib/utils";

type Props = {
  busy?: boolean;
  showProgress?: boolean;
  children: React.ReactNode;
  className?: string;
};

/** refresh 영역 — aria-busy + 상단 progress bar */
export function RefreshScopeShell({
  busy = false,
  showProgress = false,
  children,
  className,
}: Props) {
  return (
    <div className={cn("relative", className)} aria-busy={busy || undefined}>
      <SoftRefreshProgress visible={showProgress} />
      {children}
    </div>
  );
}
