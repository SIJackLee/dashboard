"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { AccountMenu } from "@/components/account/account-menu";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import type { ModuleReceipt } from "@/lib/data/iot";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Role = "admin" | "operator" | "viewer";

type Props = {
  user: {
    displayName: string | null;
    email: string | null;
    role: Role | null;
  };
  receipts?: ModuleReceipt[];
  farmLocationOptions?: EditableFarmOption[];
  canEditLocation?: boolean;
};

export function AppHeaderAccount({
  user,
  receipts = [],
  farmLocationOptions = [],
  canEditLocation = false,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-2 md:gap-3">
      <AccountMenu
        user={user}
        receipts={receipts}
        farmLocationOptions={farmLocationOptions}
        canEditLocation={canEditLocation}
      />
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
