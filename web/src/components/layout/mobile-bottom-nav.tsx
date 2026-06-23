"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import {
  isAdminOpsNavPath,
  isMonitoringNavPath,
} from "@/lib/dashboard-sections";
import {
  parseDevicesPanel,
  setDevicesPanelParam,
  type DevicesPanelId,
} from "@/lib/monitoring/devices-panel";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Role = "admin" | "operator" | "viewer";

type Props = {
  role: Role | null;
};

function FarmPanelNavItem({
  panel,
  label,
  icon: Icon,
  active,
  onSelect,
  disabled,
}: {
  panel: DevicesPanelId;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  onSelect: (panel: DevicesPanelId) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(panel)}
      aria-current={active ? "page" : undefined}
      className={cn(
        dashboardUi.mobileBottomNavItem,
        active ? "text-emerald-700" : "text-muted-foreground"
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span>{label}</span>
    </button>
  );
}

export function MobileBottomNav({ role }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const isAdmin = role === "admin";
  const onFarm = pathname === "/farm";
  const monitoringActive = isMonitoringNavPath(pathname);
  const adminOpsActive = isAdminOpsNavPath(pathname);
  const activePanel = onFarm ? parseDevicesPanel(searchParams.get("panel"), isAdmin) : "control";

  const selectFarmPanel = (panel: DevicesPanelId) => {
    if (isPending) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "ops");
    setDevicesPanelParam(params, panel);
    params.delete("ok");
    params.delete("error");
    const q = params.toString();
    startTransition(() => {
      router.replace(q ? `/farm?${q}` : "/farm?tab=ops", { scroll: false });
    });
  };

  const goSection = (href: string) => {
    if (isPending) return;
    startTransition(() => {
      router.push(href);
    });
  };

  const farmerFarmNav = onFarm && !isAdmin;

  return (
    <nav
      className={dashboardUi.mobileBottomNav}
      aria-label="모바일 앱 메뉴"
    >
      {farmerFarmNav ? (
        <>
          <FarmPanelNavItem
            panel="control"
            label="모니터링"
            icon={LayoutDashboard}
            active={activePanel === "control"}
            disabled={isPending}
            onSelect={selectFarmPanel}
          />
          <FarmPanelNavItem
            panel="display"
            label="표시"
            icon={LayoutGrid}
            active={activePanel === "display"}
            disabled={isPending}
            onSelect={selectFarmPanel}
          />
          <FarmPanelNavItem
            panel="farm"
            label="농장"
            icon={MapPin}
            active={activePanel === "farm"}
            disabled={isPending}
            onSelect={selectFarmPanel}
          />
        </>
      ) : (
        <>
          <Link
            href="/farm"
            scroll={false}
            aria-current={monitoringActive ? "page" : undefined}
            onClick={(e) => {
              if (monitoringActive && !searchParams.toString()) return;
              e.preventDefault();
              goSection("/farm");
            }}
            className={cn(
              dashboardUi.mobileBottomNavItem,
              monitoringActive
                ? "text-emerald-700"
                : "text-muted-foreground",
              isPending && "pointer-events-none opacity-70"
            )}
          >
            <LayoutDashboard className="size-5 shrink-0" aria-hidden />
            <span>모니터링</span>
          </Link>

          {isAdmin ? (
            <Link
              href="/admin/ops"
              scroll={false}
              aria-current={adminOpsActive ? "page" : undefined}
              onClick={(e) => {
                const onOpsHome =
                  pathname === "/admin/ops" && !searchParams.get("tab");
                if (onOpsHome) return;
                e.preventDefault();
                goSection("/admin/ops");
              }}
              className={cn(
                dashboardUi.mobileBottomNavItem,
                adminOpsActive
                  ? "text-emerald-700"
                  : "text-muted-foreground",
                isPending && "pointer-events-none opacity-70"
              )}
            >
              <ShieldCheck className="size-5 shrink-0" aria-hidden />
              <span>운영</span>
            </Link>
          ) : null}
        </>
      )}
    </nav>
  );
}
