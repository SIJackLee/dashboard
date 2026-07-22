"use client";

import { Loader2, LogOut } from "lucide-react";
import { useFormStatus } from "react-dom";
import { BusyButtonLabel } from "@/components/common/busy-button-label";
import { signOut } from "@/app/auth/actions";
import { AccountMenu } from "@/components/account/account-menu";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import type { FarmKey } from "@/lib/data/farm-key";
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
  farmOptions?: FarmKey[];
  canEditLocation?: boolean;
};

function LogoutSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={cn(
        dashboardUi.topLogoutBtn,
        "whitespace-nowrap disabled:cursor-wait disabled:opacity-90",
      )}
      aria-label={pending ? "로그아웃 중" : "로그아웃"}
    >
      {pending ? (
        <Loader2 className={cn(dashboardUi.topLogoutIcon, "animate-spin")} />
      ) : (
        <LogOut className={dashboardUi.topLogoutIcon} />
      )}
      <span className="hidden md:inline">
        <BusyButtonLabel
          busy={pending}
          idleLabel="로그아웃"
          busyLabel="로그아웃 중…"
        />
      </span>
    </button>
  );
}

export function AppHeaderAccount({
  user,
  receipts = [],
  farmLocationOptions = [],
  farmOptions = [],
  canEditLocation = false,
}: Props) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 md:gap-3">
      <AccountMenu
        user={user}
        receipts={receipts}
        farmLocationOptions={farmLocationOptions}
        farmOptions={farmOptions}
        canEditLocation={canEditLocation}
      />
      <form action={signOut} className="hidden shrink-0 md:block">
        <LogoutSubmitButton />
      </form>
    </div>
  );
}
