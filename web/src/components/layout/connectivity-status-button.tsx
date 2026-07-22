"use client";

import { useSyncExternalStore } from "react";
import { Wifi } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FarmOverview } from "@/lib/data/iot";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

type Props = {
  overview?: FarmOverview;
};

function formatCount(n?: number): string {
  if (n === undefined) return "--";
  return n > 99 ? "99+" : String(n);
}

function connectivityMessage(overview?: FarmOverview): string {
  const registered = overview?.controllerCount;
  if (registered === undefined) {
    return "컨트롤러 연결 정보를 불러올 수 없습니다.";
  }

  const offline = overview?.offlineCount ?? 0;
  const connected =
    overview?.connectedCount ?? Math.max(registered - offline, 0);

  return `${registered}개 컨트롤러 중 ${connected}개 컨트롤러가 연결되어 있습니다.`;
}

/** bordered 헤더 버튼 + 알람 bell형 아이콘·배지 오버레이 */
export function ConnectivityStatusButton({ overview }: Props) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const viewportCompact = useHydrationSafeDashboardCompact();
  const registered = overview?.controllerCount;
  const offline = overview?.offlineCount ?? 0;
  const alert = offline > 0;
  const badge = formatCount(registered);
  const title =
    registered === undefined
      ? "컨트롤러 연결 현황"
      : `등록 ${registered} · 오프라인 ${offline}`;
  const ariaLabel =
    registered === undefined
      ? "컨트롤러 연결 현황"
      : `등록 ${registered}컨트롤러, 오프라인 ${offline}컨트롤러`;
  const message = connectivityMessage(overview);

  const triggerClassName = cn(
    dashboardUi.topHeaderActionBtn,
    alert && dashboardUi.topHeaderActionBtnAlert,
  );

  const triggerBody = (
    <>
      <Wifi className={dashboardUi.topHeaderOverlayIcon} aria-hidden />
      {registered !== undefined ? (
        <span
          className={cn(
            dashboardUi.topHeaderCountBadge,
            alert
              ? dashboardUi.topHeaderCountBadgeAlert
              : dashboardUi.topHeaderCountBadgeOk,
          )}
          suppressHydrationWarning
        >
          {badge}
        </span>
      ) : null}
    </>
  );

  if (!mounted) {
    return (
      <button
        type="button"
        className={triggerClassName}
        data-tour-id="header-connectivity"
        aria-label={ariaLabel}
        title={title}
      >
        {triggerBody}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={triggerClassName}
        data-tour-id="header-connectivity"
        aria-label={ariaLabel}
        title={title}
      >
        {triggerBody}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-mobile-viewport-dropdown={viewportCompact || undefined}
        className="w-auto min-w-[14rem] max-w-[min(100vw-1rem,22rem)] p-3 text-sm leading-snug"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-0 py-0 text-sm font-medium text-foreground">
            컨트롤러 연결
          </DropdownMenuLabel>
          <p className="mt-2 px-0 text-muted-foreground">{message}</p>
          {offline > 0 ? (
            <p className="mt-1 px-0 font-medium text-red-600 dark:text-red-400">
              오프라인 {offline}개
            </p>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
