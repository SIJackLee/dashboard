"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutDashboard, Loader2 } from "lucide-react";
import Link from "next/link";
import { isMonitoringNavPath } from "@/lib/dashboard-sections";
import {
  buildFarmMonitoringHomePath,
  buildFarmMonitoringHomeParams,
  currentFarmSearchParams,
  isFarmMonitoringSoftHome,
  replaceFarmUrlShallow,
  requestFarmHubViewResync,
} from "@/lib/farm/farm-view-url";
import { dashboardChroma, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Role = "admin" | "operator" | "viewer";

type Props = {
  /** @deprecated 운영 탭 제거 — 호환용으로 유지 */
  role?: Role | null;
  /** 폰 너비 컬럼 안에 고정 (뷰포트 전체 fixed 아님) */
  docked?: boolean;
};

/** 운영은 헤더 도구(Shield)로 진입 — 하단 탭에서는 모니터링만 */
export function MobileBottomNav({ docked = false }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const monitoringActive = isMonitoringNavPath(pathname);

  /** SSR·Link용 — Next searchParams. 클릭 시 window URL로 재계산 */
  const monitoringHomeHref = useMemo(
    () => buildFarmMonitoringHomePath(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  if (!isPending && pendingHref != null) {
    setPendingHref(null);
  }

  const goMonitoringHome = () => {
    const live = currentFarmSearchParams();
    const homeParams = buildFarmMonitoringHomeParams(live);
    const href = buildFarmMonitoringHomePath(live);

    if (pathname === "/farm" && isFarmMonitoringSoftHome(live)) {
      return;
    }

    setPendingHref(href);

    if (pathname === "/farm") {
      startTransition(() => {
        replaceFarmUrlShallow(homeParams);
        // layout 밖 Provider — hubUrlEpoch 대신 전용 resync
        requestFarmHubViewResync();
      });
      return;
    }

    startTransition(() => {
      router.push(href);
    });
  };

  const monitoringBusy =
    isPending &&
    pendingHref != null &&
    (pendingHref === "/farm" || pendingHref.startsWith("/farm?"));

  return (
    <nav
      className={cn(
        dashboardUi.mobileBottomNav,
        docked
          ? dashboardUi.mobileBottomNavDocked
          : dashboardUi.mobileBottomNavFixed,
      )}
      aria-label="모바일 앱 메뉴"
      aria-busy={isPending || undefined}
    >
      <Link
        href={monitoringHomeHref}
        scroll={false}
        aria-current={monitoringActive ? "page" : undefined}
        aria-busy={monitoringBusy || undefined}
        onClick={(e) => {
          e.preventDefault();
          goMonitoringHome();
        }}
        className={cn(
          dashboardUi.mobileBottomNavItem,
          monitoringActive
            ? cn(dashboardChroma.chromeActiveText, "font-semibold")
            : "text-muted-foreground",
          monitoringBusy && "opacity-70",
        )}
      >
        {monitoringBusy ? (
          <Loader2 className="size-5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <LayoutDashboard className="size-5 shrink-0" aria-hidden />
        )}
        <span>{monitoringBusy ? "이동 중…" : "모니터링"}</span>
      </Link>
    </nav>
  );
}
