"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { LogOut, ShieldCheck } from "lucide-react";
import { useDisplayEnabled } from "@/components/display/display-settings-provider";
import { isPiggyPlayEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { navItems } from "./nav-items";
import { signOut } from "@/app/auth/actions";

type Role = "admin" | "operator" | "viewer";

const roleLabel: Record<Role, string> = {
  admin: "관리자",
  operator: "운영자",
  viewer: "뷰어",
};

type AppSidebarProps = {
  user: {
    displayName: string | null;
    email: string | null;
    role: Role | null;
  };
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const showPiggyMenu = isPiggyPlayEnabled(useDisplayEnabled("global.piggyMenu"));
  const name = user.displayName?.trim() || user.email || "사용자";
  const initial = name.charAt(0).toUpperCase();

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-background",
        dashboardUi.sidebarWidth
      )}
    >
      <div className={cn(dashboardUi.sidebarBrand, "shrink-0")}>
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center rounded-lg bg-muted/40",
            dashboardUi.sidebarBrandIcon
          )}
        >
          <Image
            src="/logo.jpg"
            alt="IoT Board"
            width={40}
            height={40}
            className="h-full w-full object-contain p-1"
            priority
          />
        </div>
        <div className="min-w-0 leading-tight">
          <p className={dashboardUi.sidebarBrandTitle}>IoT Board</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {navItems
          .filter((item) => item.href !== "/play" || showPiggyMenu)
          .map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <AppNavLink
              key={item.href}
              href={item.href}
              className={cn(
                dashboardUi.navLink,
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={dashboardUi.navIcon} />
              {item.label}
            </AppNavLink>
          );
        })}

        {user.role === "admin" && (
          <AppNavLink
            href="/admin/users"
            message="사용자 관리로 이동 중…"
            className={cn(
              dashboardUi.navLink,
              pathname.startsWith("/admin")
                ? "bg-emerald-50 text-emerald-700"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ShieldCheck className={dashboardUi.navIcon} />
            사용자 관리
          </AppNavLink>
        )}
      </nav>

      <div className={dashboardUi.accountBlock}>
        <div className="flex items-center gap-3 px-1">
          <span className={dashboardUi.accountAvatar}>{initial}</span>
          <div className="min-w-0 leading-tight">
            <p className={dashboardUi.accountName}>{name}</p>
            <p className={dashboardUi.accountRole}>
              {user.role ? roleLabel[user.role] : "권한 없음"}
            </p>
          </div>
        </div>
        <form action={signOut}>
          <button type="submit" className={dashboardUi.logoutBtn}>
            <LogOut className={dashboardUi.navIcon} />
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
