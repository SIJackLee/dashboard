"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ADMIN_OPS_TABS,
  adminOpsHref,
  parseAdminOpsTabFromPathname,
  type AdminOpsTabId,
} from "@/lib/admin/ops-tabs";
import { useScrollActiveTab } from "@/lib/ui/use-scroll-active-tab";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export function AdminOpsTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const active = parseAdminOpsTabFromPathname(pathname);
  const navRef = useScrollActiveTab(active);

  const prefetchTab = useCallback(
    (tab: AdminOpsTabId) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("ok");
      params.delete("error");
      params.delete("count");
      params.delete("tab");
      const q = params.toString();
      const href = adminOpsHref(tab, q ? params : undefined);
      router.prefetch(href);
    },
    [router, searchParams],
  );

  const selectTab = (tab: AdminOpsTabId) => {
    if (tab === active || isPending) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("ok");
    params.delete("error");
    params.delete("count");
    params.delete("tab");
    const q = params.toString();
    const href = adminOpsHref(tab, q ? params : undefined);

    startTransition(() => {
      router.push(href, { scroll: false });
    });
  };

  return (
    <nav
      ref={navRef}
      className={cn(
        "flex shrink-0 gap-1 overflow-x-auto overscroll-x-contain border-b pb-1 [scrollbar-width:none] max-lg:flex-nowrap lg:flex-wrap lg:gap-2",
        isPending && "opacity-80",
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
            onMouseEnter={() => prefetchTab(tab.id)}
            onFocus={() => prefetchTab(tab.id)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 whitespace-nowrap transition-colors disabled:pointer-events-none",
              dashboardUi.tabNav,
              isActive
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
