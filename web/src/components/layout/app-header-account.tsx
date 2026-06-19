"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Role = "admin" | "operator" | "viewer";

const roleLabel: Record<Role, string> = {
  admin: "관리자",
  operator: "운영자",
  viewer: "뷰어",
};

type Props = {
  user: {
    displayName: string | null;
    email: string | null;
    role: Role | null;
  };
};

export function AppHeaderAccount({ user }: Props) {
  const name = user.displayName?.trim() || user.email || "사용자";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="flex shrink-0 items-center gap-2 md:gap-3">
      <div className="flex min-w-0 items-center gap-2 px-1">
        <span className={dashboardUi.headerAccountAvatar}>{initial}</span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <p className={dashboardUi.headerAccountName}>{name}</p>
          <p className={dashboardUi.headerAccountRole}>
            {user.role ? roleLabel[user.role] : "권한 없음"}
          </p>
        </div>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className={cn(dashboardUi.topLogoutBtn, "whitespace-nowrap")}
          aria-label="로그아웃"
        >
          <LogOut className={dashboardUi.topLogoutIcon} />
          <span className="hidden md:inline">로그아웃</span>
        </button>
      </form>
    </div>
  );
}
