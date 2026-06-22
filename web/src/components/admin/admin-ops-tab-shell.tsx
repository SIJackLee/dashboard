import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

/** 운영 탭 본문 — 시스템 탭과 동일 full-width·scroll 영역 */
export function AdminOpsTabShell({ children, className }: Props) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-h-[calc(100vh-9rem)] flex-1 flex-col overflow-hidden",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
