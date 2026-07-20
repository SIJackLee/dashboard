"use client";

import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { isAdminOpsNavPath } from "@/lib/dashboard-sections";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

/** Admin 전용 — 운영 ↔ 모니터링 토글 (header-actions). */
export function AdminOpsHeaderButton() {
  const pathname = usePathname();
  const onOps = isAdminOpsNavPath(pathname);
  const href = onOps ? "/farm" : "/admin/ops";
  const message = onOps
    ? "모니터링으로 이동 중…"
    : "운영으로 이동 중…";

  return (
    <AppNavLink
      href={href}
      message={message}
      className={cn(
        dashboardUi.topHeaderActionBtn,
        onOps &&
          "border-emerald-600/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300",
      )}
      aria-label={onOps ? "운영 종료 — 모니터링으로" : "운영"}
      aria-pressed={onOps}
      title={onOps ? "운영 → 모니터링" : "모니터링 → 운영"}
      data-tour-id="header-ops"
    >
      <ShieldCheck className="size-4 md:size-5" aria-hidden />
      <span className="sr-only">
        {onOps ? "모니터링으로 이동" : "운영으로 이동"}
      </span>
    </AppNavLink>
  );
}
