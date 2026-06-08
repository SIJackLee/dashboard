"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, LogOut, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const name = user.displayName?.trim() || user.email || "사용자";
  const initial = name.charAt(0).toUpperCase();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-background">
      {/* 브랜드 */}
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex size-8 items-center justify-center rounded-md bg-emerald-600 text-white">
          <Leaf className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">스마트 축사</p>
          <p className="text-xs text-muted-foreground">IoT</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}

        {user.role === "admin" && (
          <Link
            href="/admin/users"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-emerald-50 text-emerald-700"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <ShieldCheck className="size-4" />
            사용자 관리
          </Link>
        )}
      </nav>

      {/* 계정 */}
      <div className="space-y-2 border-t p-3">
        <div className="flex items-center gap-2 px-1">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {initial}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">
              {user.role ? roleLabel[user.role] : "권한 없음"}
            </p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
            로그아웃
          </button>
        </form>
      </div>
    </aside>
  );
}
