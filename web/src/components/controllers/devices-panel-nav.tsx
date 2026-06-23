"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, Cpu, LayoutGrid, MapPin } from "lucide-react";
import {
  getDevicesPanelLabel,
  getVisibleDevicesPanels,
  type DevicesPanelId,
  setDevicesPanelParam,
} from "@/lib/monitoring/devices-panel";
import { setMonitoringTabParam } from "@/lib/monitoring/monitoring-tabs";
import { useScrollActiveTab } from "@/lib/ui/use-scroll-active-tab";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const PANEL_ICONS = {
  control: Cpu,
  alarm: Bell,
  display: LayoutGrid,
  farm: MapPin,
} as const;

type Props = {
  active: DevicesPanelId;
  isAdmin?: boolean;
};

export function DevicesPanelNav({ active, isAdmin = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const panels = getVisibleDevicesPanels(isAdmin);
  const navRef = useScrollActiveTab(active);

  if (panels.length === 0) return null;

  const selectPanel = (panel: DevicesPanelId) => {
    if (panel === active || isPending) return;
    const params = new URLSearchParams(searchParams.toString());
    setMonitoringTabParam(params, "ops");
    setDevicesPanelParam(params, panel);
    params.delete("ok");
    params.delete("error");
    const q = params.toString();
    const href = q ? `/farm?${q}` : "/farm?tab=ops";

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  };

  return (
    <nav
      ref={navRef}
      className={cn(
        "-mx-1 hidden gap-2 overflow-x-auto overscroll-x-contain border-b pb-1 [scrollbar-width:none] lg:flex lg:flex-wrap",
        isPending && "opacity-80"
      )}
      aria-label="컨트롤러 설정 서브 탭"
      aria-busy={isPending || undefined}
    >
      {panels.map((panel) => {
        const Icon = PANEL_ICONS[panel];
        const isActive = active === panel;
        return (
          <button
            key={panel}
            type="button"
            disabled={isPending}
            onClick={() => selectPanel(panel)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 transition-colors disabled:pointer-events-none max-lg:gap-1 lg:gap-2",
              dashboardUi.tabNav,
              isActive
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0 lg:size-7" aria-hidden />
            <span className="text-xs lg:text-base">{getDevicesPanelLabel(panel)}</span>
          </button>
        );
      })}
    </nav>
  );
}
