"use client";

import type { ReactNode } from "react";
import { accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";

type Props = {
  /** 10px micro label — «농장» «주소» 등 */
  label?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tourId?: string;
  isolateEvents?: boolean;
};

export function AccountMenuSection({
  label,
  action,
  children,
  className,
  tourId,
  isolateEvents = false,
}: Props) {
  return (
    <div
      className={cn(accountMenuLayout.section, className)}
      data-tour-id={tourId}
      onKeyDown={isolateEvents ? (e) => e.stopPropagation() : undefined}
      onPointerDown={isolateEvents ? (e) => e.stopPropagation() : undefined}
    >
      {label ? (
        <div className={accountMenuLayout.sectionMicroHeader}>
          <span className={accountMenuLayout.sectionMicroLabel}>{label}</span>
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}
