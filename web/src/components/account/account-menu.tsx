"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecentActivityMenuSection } from "@/components/account/recent-activity-menu-section";
import { FarmAddressInput } from "@/components/settings/farm-address-input";
import { FarmSwitcher } from "@/components/layout/farm-switcher";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import {
  farmShortLabel,
  type FarmSummaryRow,
} from "@/lib/data/farm-summaries";
import type { FarmKey } from "@/lib/data/farm-key";
import type { ModuleReceipt } from "@/lib/data/iot";
import { farmOptionId } from "@/lib/settings/farm-location-client";
import { signOut } from "@/app/auth/actions";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

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
  farmOptions?: FarmKey[];
  activeFarmKey?: FarmKey | null;
  farmSummaries?: FarmSummaryRow[];
  canEditLocation?: boolean;
};

export function AccountMenu({
  user,
  receipts = [],
  farmLocationOptions = [],
  farmOptions = [],
  activeFarmKey = null,
  farmSummaries = [],
  canEditLocation = false,
}: Props) {
  const router = useRouter();
  const mobile = useMobileLayout();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const name = user.displayName?.trim() || user.email || "사용자";
  const initial = name.charAt(0).toUpperCase();
  const primaryFarm = farmLocationOptions[0];

  const triggerClassName =
    "flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-muted/60";

  const triggerInner = (
    <>
      <span className={dashboardUi.headerAccountAvatar}>{initial}</span>
      <div className="hidden min-w-0 leading-tight sm:block">
        <p className={dashboardUi.headerAccountName}>{name}</p>
        <p className={dashboardUi.headerAccountRole}>
          {user.role ? roleLabel[user.role] : "권한 없음"}
        </p>
      </div>
      <ChevronDown
        className="hidden size-4 shrink-0 text-muted-foreground sm:block"
        aria-hidden
      />
    </>
  );

  if (!mounted) {
    return (
      <button
        type="button"
        className={triggerClassName}
        data-tour-id="header-account"
        aria-label="계정 메뉴"
      >
        {triggerInner}
      </button>
    );
  }

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className={triggerClassName}
        data-tour-id="header-account"
        aria-label="계정 메뉴"
      >
        {triggerInner}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={mobile ? 8 : 4}
        className={cn(
          "w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-xl p-0",
          dashboardUi.alarmMenuContent,
          mobile &&
            "max-md:rounded-2xl max-md:border max-md:border-border/60 max-md:bg-card max-md:shadow-lg",
        )}
      >
        <div className="border-b px-4 py-3">
          <p className="truncate font-semibold leading-snug">{name}</p>
          {user.email ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {user.email}
            </p>
          ) : null}
          {user.role ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {roleLabel[user.role]}
            </p>
          ) : null}
        </div>

        {farmOptions.length > 0 ? (
          <div
            className="border-b"
            onKeyDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <p className="px-4 pt-3 text-[11px] font-medium text-muted-foreground">
              농장
              {activeFarmKey
                ? ` · ${farmShortLabel(activeFarmKey)}`
                : ` · 전체 ${farmOptions.length}개`}
            </p>
            <FarmSwitcher
              farmOptions={farmOptions}
              activeFarmKey={activeFarmKey}
              farmSummaries={farmSummaries}
              compact
              variant="inline"
              onNavigated={() => setOpen(false)}
            />
          </div>
        ) : null}

        {receipts.length > 0 ? (
          <div className="border-t">
            <RecentActivityMenuSection receipts={receipts} />
          </div>
        ) : null}

        {primaryFarm ? (
          <div
            className="border-t px-4 py-3"
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
              deferFocusUntilTap={mobile && open}
              onSaved={() => router.refresh()}
            />
          </div>
        ) : null}

        <div className="border-t p-1.5 md:hidden">
          <DropdownMenuItem
            className="gap-2 rounded-lg px-3 py-2 text-destructive focus:text-destructive"
            onClick={() => {
              void signOut();
            }}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            로그아웃
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
