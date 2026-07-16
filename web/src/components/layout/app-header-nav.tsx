"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { isAdminOpsNavPath } from "@/lib/dashboard-sections";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { adminNavItems } from "./nav-items";

type Role = "admin" | "operator" | "viewer";

type Props = {
  role: Role | null;
};

/** 헤더 앱 메뉴 — admin 운영 허브만 (모니터링은 단일 /farm, 중복 링크 제거). */
export function AppHeaderNav({ role }: Props) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (role !== "admin") {
    return null;
  }

  return (
    <nav
      className="hidden shrink-0 flex-wrap items-center gap-1 md:flex"
      aria-label="앱 메뉴"
      suppressHydrationWarning
    >
      {adminNavItems.map((item) => {
        const active = mounted && isAdminOpsNavPath(pathname);
        return (
          <AppNavLink
            key={item.href}
            href={item.href}
            message={`${item.label}로 이동 중…`}
            className={cn(
              dashboardUi.headerNavLink,
              active
                ? "bg-emerald-50 text-emerald-700"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon className={dashboardUi.headerNavIcon} />
            {item.label}
          </AppNavLink>
        );
      })}
    </nav>
  );
}
