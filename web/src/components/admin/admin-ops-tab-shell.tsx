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
        "flex min-h-0 flex-1 flex-col overflow-hidden max-md:min-h-0 md:min-h-[calc(100vh-9rem)]",
        className
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain md:gap-3">
        {children}
      </div>
    </div>
  );
}
