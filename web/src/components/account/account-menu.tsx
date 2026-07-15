"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, CircleHelp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FARM_TOUR_RESTART_EVENT,
  FARM_TOUR_RESTART_FLAG,
  buildFarmTourPath,
} from "@/lib/onboarding/tour-steps";
import { parseFarmKeyFromQuery, DEFAULT_FARM } from "@/lib/data/farm-key";
import { RecentActivityMenuSection } from "@/components/account/recent-activity-menu-section";
import { FarmAddressInput } from "@/components/settings/farm-address-input";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import type { FarmKey } from "@/lib/data/farm-key";
import type { ModuleReceipt } from "@/lib/data/iot";
import { farmOptionId } from "@/lib/settings/farm-location-client";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
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
  farmOptions?: FarmKey[];
  canEditLocation?: boolean;
};

export function AccountMenu({
  user,
  receipts = [],
  farmLocationOptions = [],
  farmOptions = [],
  canEditLocation = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mobile = useMobileLayout();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const name = user.displayName?.trim() || user.email || "사용자";
  const initial = name.charAt(0).toUpperCase();
  const primaryFarm = farmLocationOptions[0];
  const tourFarmKey =
    farmLocationOptions.find((o) => o.hasLiveData)?.farmKey ??
    primaryFarm?.farmKey ??
    farmOptions[0] ??
    DEFAULT_FARM;
  const farmScopedOnPage = Boolean(
    parseFarmKeyFromQuery(searchParams.get("lsind"), searchParams.get("item")),
  );
  const canRestartTourInPlace =
    pathname?.startsWith("/farm") && farmScopedOnPage;

  const restartTour = () => {
    if (canRestartTourInPlace) {
      window.dispatchEvent(new Event(FARM_TOUR_RESTART_EVENT));
      return;
    }
    try {
      sessionStorage.setItem(FARM_TOUR_RESTART_FLAG, "1");
    } catch {
      /* storage 사용 불가 시 이동만 수행 */
    }
    const target = buildFarmTourPath(tourFarmKey);
    // admin 허브 → 단일 농장: router.push는 RSC props(농장 스코프)가 갱신되지 않을 수 있음.
    window.location.assign(target);
  };

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
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
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
        sideOffset={mobile ? 8 : 4}
        className={cn(
          "w-[min(100vw-1.5rem,22rem)] rounded-xl p-0",
          dashboardUi.alarmMenuContent,
          mobile &&
            "origin-top data-open:zoom-in-100 data-closed:zoom-out-100 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-top-2 data-open:duration-200 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-top-1 data-closed:duration-150 max-md:rounded-2xl max-md:border max-md:border-border/60 max-md:bg-card max-md:shadow-lg"
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

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="mx-1 gap-2"
          onClick={restartTour}
        >
          <CircleHelp className="size-4 text-muted-foreground" aria-hidden />
          기능 안내 다시 보기
        </DropdownMenuItem>

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
                deferFocusUntilTap={mobile && open}
                onSaved={() => router.refresh()}
              />
            </div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
