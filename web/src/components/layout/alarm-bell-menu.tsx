"use client";

import { useEffect, useState } from "react";
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
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  alarms: AlarmRow[];
};

export function AlarmBellMenu({ alarms }: Props) {
  const { navigate, isPending } = useAppNavigate();
  const [mounted, setMounted] = useState(false);
  const active = alarms.filter((a) => a.status === "active");
  const count = active.length;
  const preview = active.slice(0, 8);

  useEffect(() => setMounted(true), []);

  const triggerLabel = count > 0 ? `알림 ${count}건` : "알림";

  const countBadge = count > 0 ? (
    <span
      className="absolute -right-0.5 -top-0.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold leading-none text-white lg:min-h-[1.5rem] lg:min-w-[1.5rem] lg:px-1 lg:text-[1rem]"
      suppressHydrationWarning
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null;

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(dashboardUi.topIconBtn, "relative")}
        aria-label={triggerLabel}
      >
        <Bell className={dashboardUi.topBellIcon} />
        {countBadge}
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(dashboardUi.topIconBtn, "relative")}
        aria-label={triggerLabel}
      >
        <Bell className={dashboardUi.topBellIcon} />
        {countBadge}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
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
              <span>활성 알림</span>
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
              "max-md:rounded-xl max-md:bg-muted/20 max-md:py-4 max-md:text-sm"
            )}
          >
            활성 알림 없음
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
              {count > preview.length ? `전체 ${count}건 보기` : "이상 탭으로 이동"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
