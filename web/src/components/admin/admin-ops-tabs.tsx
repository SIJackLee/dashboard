"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ADMIN_OPS_TABS,
  ADMIN_OPS_BASE_PATH,
  type AdminOpsTabId,
  setAdminOpsTabParam,
} from "@/lib/admin/ops-tabs";
import { useScrollActiveTab } from "@/lib/ui/use-scroll-active-tab";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  active: AdminOpsTabId;
};

export function AdminOpsTabs({ active }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const navRef = useScrollActiveTab(active);

  const selectTab = (tab: AdminOpsTabId) => {
    if (tab === active || isPending) return;
    const params = new URLSearchParams(searchParams.toString());
    setAdminOpsTabParam(params, tab);
    params.delete("ok");
    params.delete("error");
    params.delete("count");
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
        "flex shrink-0 gap-1 overflow-x-auto overscroll-x-contain border-b pb-1 [scrollbar-width:none] max-lg:flex-nowrap lg:flex-wrap lg:gap-2",
        isPending && "opacity-80"
      )}
      aria-label="운영 탭"
      aria-busy={isPending || undefined}
    >
      {ADMIN_OPS_TABS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={isPending}
            onClick={() => selectTab(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 whitespace-nowrap transition-colors disabled:pointer-events-none",
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
