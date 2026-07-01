"use client";

import { usePathname } from "next/navigation";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { isAdminOpsNavPath, isMonitoringNavPath } from "@/lib/dashboard-sections";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { adminNavItems, navItems } from "./nav-items";

type Role = "admin" | "operator" | "viewer";

type Props = {
  role: Role | null;
};

export function AppHeaderNav({ role }: Props) {
  const pathname = usePathname();

  return (
    <nav
      className="hidden shrink-0 flex-wrap items-center gap-1 md:flex"
      aria-label="앱 메뉴"
    >
      {navItems.map((item) => {
          const active =
            item.href === "/farm"
              ? isMonitoringNavPath(pathname)
              : pathname.startsWith(item.href);
          return (
            <AppNavLink
              key={item.href}
              href={item.href}
              className={cn(
                dashboardUi.headerNavLink,
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={dashboardUi.headerNavIcon} />
              {item.label}
            </AppNavLink>
          );
        })}

      {role === "admin" &&
        adminNavItems.map((item) => {
          const active = isAdminOpsNavPath(pathname);
          return (
            <AppNavLink
              key={item.href}
              href={item.href}
              message={`${item.label}로 이동 중…`}
              className={cn(
                dashboardUi.headerNavLink,
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
