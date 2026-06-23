"use client";

import { useEffect, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MONITORING_TABS,
  MONITORING_BASE_PATH,
  type MonitoringTabId,
  sanitizeMonitoringSearchParams,
  setMonitoringTabParam,
} from "@/lib/monitoring/monitoring-tabs";
import { setDevicesPanelParam } from "@/lib/monitoring/devices-panel";
import { useScrollActiveTab } from "@/lib/ui/use-scroll-active-tab";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  active: MonitoringTabId;
  /** Farmer — 모바일에서 현황 탭 숨김·ops 기본 */
  isAdmin?: boolean;
};

export function MonitoringTabs({ active, isAdmin = false }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const navRef = useScrollActiveTab(active);
  const isMobile = useMobileLayout();

  const visibleTabs = useMemo(() => {
    if (isAdmin || !isMobile) return MONITORING_TABS;
    return MONITORING_TABS.filter((tab) => tab.id === "ops");
  }, [isAdmin, isMobile]);

  useEffect(() => {
    if (isAdmin || !isMobile || active !== "map") return;

    const params = new URLSearchParams(searchParams.toString());
    setMonitoringTabParam(params, "ops");
    const q = params.toString();
    const href = q ? `${MONITORING_BASE_PATH}?${q}` : `${MONITORING_BASE_PATH}?tab=ops`;

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }, [isAdmin, isMobile, active, searchParams, router]);

  const selectTab = (tab: MonitoringTabId) => {
    if (isPending) return;

    if (tab === "map") {
      startTransition(() => {
        router.replace(MONITORING_BASE_PATH, { scroll: false });
      });
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    if (tab === active && tab === "ops" && params.has("panel")) {
      setDevicesPanelParam(params, "control");
      params.delete("ok");
      params.delete("error");
      const q = params.toString();
      const href = q ? `${MONITORING_BASE_PATH}?${q}` : MONITORING_BASE_PATH;
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
      return;
    }

    if (tab === active) return;
    sanitizeMonitoringSearchParams(params, tab);
    const q = params.toString();
    const href = q ? `${MONITORING_BASE_PATH}?${q}` : MONITORING_BASE_PATH;

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  };

  if (visibleTabs.length <= 1) {
    return null;
  }

  return (
    <nav
      ref={navRef}
      className={cn(
        "flex gap-1 overflow-x-auto overscroll-x-contain border-b pb-1 [scrollbar-width:none] max-lg:flex-nowrap lg:flex-wrap lg:gap-2",
        isPending && "opacity-80"
      )}
      aria-label="모니터링 탭"
      aria-busy={isPending || undefined}
    >
      {visibleTabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={isPending}
            onClick={() => selectTab(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 transition-colors disabled:pointer-events-none",
              dashboardUi.tabNav,
              isActive
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
