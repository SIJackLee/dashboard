"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  isAdminOpsNavPath,
  isMonitoringNavPath,
} from "@/lib/dashboard-sections";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Role = "admin" | "operator" | "viewer";

type Props = {
  role: Role | null;
};

export function MobileBottomNav({ role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const isAdmin = role === "admin";
  const monitoringActive = isMonitoringNavPath(pathname);
  const adminOpsActive = isAdminOpsNavPath(pathname);

  const goSection = (href: string) => {
    if (isPending) return;
    startTransition(() => {
      router.push(href);
    });
  };

  return (
    <nav className={dashboardUi.mobileBottomNav} aria-label="모바일 앱 메뉴">
      <Link
        href="/farm"
        scroll={false}
        aria-current={monitoringActive ? "page" : undefined}
        onClick={(e) => {
          if (monitoringActive && !searchParams.toString()) return;
          e.preventDefault();
          goSection("/farm");
        }}
        className={cn(
          dashboardUi.mobileBottomNavItem,
          monitoringActive ? "text-emerald-700" : "text-muted-foreground",
          isPending && "pointer-events-none opacity-70"
        )}
      >
        <LayoutDashboard className="size-5 shrink-0" aria-hidden />
        <span>모니터링</span>
      </Link>

      {isAdmin ? (
        <Link
          href="/admin/ops"
          scroll={false}
          aria-current={adminOpsActive ? "page" : undefined}
          onClick={(e) => {
            const onOpsHome =
              pathname === "/admin/ops" && !searchParams.get("tab");
            if (onOpsHome) return;
            e.preventDefault();
            goSection("/admin/ops");
          }}
          className={cn(
            dashboardUi.mobileBottomNavItem,
            adminOpsActive ? "text-emerald-700" : "text-muted-foreground",
            isPending && "pointer-events-none opacity-70"
          )}
        >
          <ShieldCheck className="size-5 shrink-0" aria-hidden />
          <span>운영</span>
        </Link>
      ) : null}
    </nav>
  );
}
