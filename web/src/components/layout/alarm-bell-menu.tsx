"use client";

import { useSyncExternalStore } from "react";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type { AlarmRow } from "@/lib/data/alarms";
import { alarmControlHref } from "@/lib/data/alarms";
import { monitoringHref } from "@/lib/monitoring/monitoring-tabs";
import { formatKst } from "@/lib/datetime/kst";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { formatControllerSlotLabel } from "@/lib/ui/controller-labels";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

type Props = {
  alarms: AlarmRow[];
};

export function AlarmBellMenu({ alarms }: Props) {
  const { navigate, isPending } = useAppNavigate();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const viewportCompact = useHydrationSafeDashboardCompact();
  const active = alarms.filter((a) => a.status === "active");
  const count = active.length;
  const preview = active.slice(0, 6);

  const triggerLabel = count > 0 ? `알림 ${count}건` : "알림";

  const countBadge = count > 0 ? (
    <span
      className={cn(
        dashboardUi.topHeaderCountBadge,
        dashboardUi.topHeaderCountBadgeAlert,
      )}
      suppressHydrationWarning
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null;

  if (!mounted) {
    return (
      <button
        type="button"
        className={dashboardUi.topHeaderActionBtn}
        data-tour-id="header-alarms"
        aria-label={triggerLabel}
      >
        <Bell className={dashboardUi.topHeaderOverlayIcon} />
        {countBadge}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={dashboardUi.topHeaderActionBtn}
        data-tour-id="header-alarms"
        aria-label={triggerLabel}
      >
        <Bell className={dashboardUi.topHeaderOverlayIcon} />
        {countBadge}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-mobile-viewport-dropdown={viewportCompact || undefined}
        className={cn(
          dashboardUi.alarmMenuContent,
          "max-md:rounded-2xl max-md:border max-md:border-border/60 max-md:bg-card max-md:p-3 max-md:shadow-none"
        )}
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel
            className={cn(
              dashboardUi.alarmMenuLabel,
              "max-md:rounded-xl max-md:bg-muted/25 max-md:px-3 max-md:py-2 max-md:text-sm"
            )}
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span>센서 알림</span>
              {count > 0 ? (
                <Badge variant="destructive" className={dashboardUi.badgeMd}>
                  {count}건
                </Badge>
              ) : null}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-2" />

        {preview.length === 0 ? (
          <p
            className={cn(
              dashboardUi.alarmMenuEmpty,
              "max-md:rounded-xl max-md:bg-muted/20 max-md:py-3 max-md:text-sm"
            )}
          >
            센서 알림 없음
          </p>
        ) : (
          preview.map((a) => (
            <DropdownMenuItem
              key={a.id}
              className={cn(
                dashboardUi.alarmMenuItem,
                "max-md:mb-1.5 max-md:rounded-xl max-md:border max-md:border-border/50 max-md:bg-muted/20 max-md:px-3 max-md:py-2.5 max-md:text-sm last:max-md:mb-0"
              )}
              disabled={isPending}
              onClick={() =>
                navigate(alarmControlHref(a), {
                  message: "컨트롤러 제어로 이동 중…",
                })
              }
            >
              <span className="flex w-full items-center justify-between gap-3">
                <span className="font-medium">{a.alarmType}</span>
                <Badge
                  variant={a.severity === "critical" ? "destructive" : "secondary"}
                  className={cn(dashboardUi.badgeMd, "shrink-0")}
                >
                  {a.severity === "critical" ? "심각" : "주의"}
                </Badge>
              </span>
              <span className={dashboardUi.alarmMenuMeta}>
                {a.stallTyCode ? formatStallTypeLabel(a.stallTyCode) : "—"} ·{" "}
                {formatControllerSlotLabel({
                  stallNo: a.stallNo,
                  eqpmnNo: a.eqpmnNo,
                  idx: a.idx,
                })}
              </span>
              <span className={cn(dashboardUi.alarmMenuMeta, "w-full truncate")}>
                {a.detail}
              </span>
              <span className={dashboardUi.alarmMenuTime}>
                {formatKst(a.occurredAt, "short")}
              </span>
            </DropdownMenuItem>
          ))
        )}

        {count > 0 ? (
          <>
            <DropdownMenuSeparator className="my-2" />
            <DropdownMenuItem
              className={cn(
                dashboardUi.alarmMenuFooter,
                "max-md:rounded-xl max-md:bg-emerald-50/80 max-md:py-2.5 max-md:text-sm"
              )}
              disabled={isPending}
              onClick={() =>
                navigate(monitoringHref("ops"), {
                  message: "이상 탭으로 이동 중…",
                })
              }
            >
              {count > preview.length
                ? `센서 알림 ${count}건 보기`
                : "이상 탭으로 이동"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
