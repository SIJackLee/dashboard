"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecentActivityMenuSection } from "@/components/account/recent-activity-menu-section";
import { FarmAddressInput } from "@/components/settings/farm-address-input";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import type { ModuleReceipt } from "@/lib/data/iot";
import { farmOptionId } from "@/lib/settings/farm-location-client";
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
  receipts?: ModuleReceipt[];
  farmLocationOptions?: EditableFarmOption[];
  canEditLocation?: boolean;
};

export function AccountMenu({
  user,
  receipts = [],
  farmLocationOptions = [],
  canEditLocation = false,
}: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const name = user.displayName?.trim() || user.email || "사용자";
  const initial = name.charAt(0).toUpperCase();
  const primaryFarm = farmLocationOptions[0];

  useEffect(() => setMounted(true), []);

  const triggerClassName =
    "flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-muted/60";

  if (!mounted) {
    return (
      <button type="button" className={triggerClassName} aria-label="계정 메뉴">
        <span className={dashboardUi.headerAccountAvatar}>{initial}</span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <p className={dashboardUi.headerAccountName}>{name}</p>
          <p className={dashboardUi.headerAccountRole}>
            {user.role ? roleLabel[user.role] : "권한 없음"}
          </p>
        </div>
        <ChevronDown className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
      </button>
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={triggerClassName} aria-label="계정 메뉴">
        <span className={dashboardUi.headerAccountAvatar}>{initial}</span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <p className={dashboardUi.headerAccountName}>{name}</p>
          <p className={dashboardUi.headerAccountRole}>
            {user.role ? roleLabel[user.role] : "권한 없음"}
          </p>
        </div>
        <ChevronDown className="hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(
          "w-[min(100vw-1.5rem,22rem)] rounded-xl p-0",
          dashboardUi.alarmMenuContent
        )}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-3 py-2 font-normal">
            <p className="font-medium">{name}</p>
            {user.email ? (
              <p className="text-xs font-normal text-muted-foreground">{user.email}</p>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>

        {receipts.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <RecentActivityMenuSection receipts={receipts} />
          </>
        ) : null}

        {primaryFarm ? (
          <>
            <DropdownMenuSeparator />
            <div
              className="px-3 py-2"
              onKeyDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <p className={cn("mb-2 font-medium", dashboardUi.tableMeta)}>
                {primaryFarm.label}
              </p>
              <FarmAddressInput
                key={farmOptionId(primaryFarm.farmKey)}
                farmKey={primaryFarm.farmKey}
                location={primaryFarm.location}
                disabled={!canEditLocation}
                compact
                onSaved={() => router.refresh()}
              />
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
