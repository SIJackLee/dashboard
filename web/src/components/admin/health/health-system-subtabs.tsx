"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ADMIN_OPS_BASE_PATH } from "@/lib/admin/ops-tabs";
import {
  HEALTH_SYSTEM_VIEWS,
  type HealthSystemViewId,
  setHealthSystemViewParam,
} from "@/lib/admin/health/system-views";
import { useScrollActiveTab } from "@/lib/ui/use-scroll-active-tab";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  active: HealthSystemViewId;
};

export function HealthSystemSubTabs({ active }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const navRef = useScrollActiveTab(active);

  const selectView = (view: HealthSystemViewId) => {
    if (view === active || isPending) return;
    const params = new URLSearchParams(searchParams.toString());
    setHealthSystemViewParam(params, view);
    const q = params.toString();
    const href = q ? `${ADMIN_OPS_BASE_PATH}?${q}` : ADMIN_OPS_BASE_PATH;

    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  };

  return (
    <nav
      ref={navRef}
      className={cn(
        "flex gap-2 overflow-x-auto overscroll-x-contain border-b border-border/60 pb-2 [scrollbar-width:none] max-lg:flex-nowrap lg:flex-wrap",
        isPending && "opacity-80"
      )}
      aria-label="시스템 하위 뷰"
      aria-busy={isPending || undefined}
    >
      {HEALTH_SYSTEM_VIEWS.map((view) => {
        const isActive = active === view.id;
        return (
          <button
            key={view.id}
            type="button"
            disabled={isPending}
            onClick={() => selectView(view.id)}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 whitespace-nowrap transition-colors disabled:pointer-events-none",
              dashboardUi.tabNav,
              isActive
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            )}
          >
            {view.label}
          </button>
        );
      })}
    </nav>
  );
}
