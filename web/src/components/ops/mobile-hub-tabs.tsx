"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MOBILE_HUB_TABS,
  type MobileHubTabId,
  setMobileHubTabParam,
} from "@/lib/monitoring/mobile-hub-tab";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  active: MobileHubTabId;
};

export function MobileHubTabs({ active }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const selectTab = (tab: MobileHubTabId) => {
    if (tab === active || isPending) return;
    const params = new URLSearchParams(searchParams.toString());
    setMobileHubTabParam(params, tab);
    const q = params.toString();
    startTransition(() => {
      router.replace(q ? `/farm?${q}` : "/farm", { scroll: false });
    });
  };

  return (
    <nav
      className={cn(
        "flex gap-1 rounded-xl border bg-muted/20 p-1 lg:hidden",
        isPending && "opacity-80"
      )}
      aria-label="모바일 허브 탭"
      aria-busy={isPending || undefined}
    >
      {MOBILE_HUB_TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={isPending}
            onClick={() => selectTab(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "min-h-[2.75rem] flex-1 rounded-lg px-2 py-2 font-medium transition-colors disabled:pointer-events-none",
              dashboardUi.tabNav,
              isActive
                ? "bg-background text-emerald-700 shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
