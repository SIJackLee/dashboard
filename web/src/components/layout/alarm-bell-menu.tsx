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
import { alarmTargetHref } from "@/lib/data/alarms";
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

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(dashboardUi.topIconBtn, "relative")}
        aria-label={triggerLabel}
      >
        <Bell className={dashboardUi.topBellIcon} />
        {count > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.85rem] font-bold leading-none text-white"
            suppressHydrationWarning
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
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
        {count > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex min-h-[1.35rem] min-w-[1.35rem] items-center justify-center rounded-full bg-red-500 px-1 text-[0.85rem] font-bold leading-none text-white"
            suppressHydrationWarning
          >
            {count > 99 ? "99+" : count}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between gap-2">
            <span>활성 알림</span>
            {count > 0 ? (
              <Badge variant="destructive" className={dashboardUi.badgeMd}>
                {count}건
              </Badge>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {preview.length === 0 ? (
          <p className="px-3 py-4 text-center text-muted-foreground text-sm">
            활성 알림 없음
          </p>
        ) : (
          preview.map((a) => (
            <DropdownMenuItem
              key={a.id}
              className="cursor-pointer flex-col items-start gap-0.5 py-2.5"
              disabled={isPending}
              onClick={() =>
                navigate(alarmTargetHref(a), {
                  message: "알람 페이지로 이동 중…",
                })
              }
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="font-medium">{a.alarmType}</span>
                <Badge
                  variant={a.severity === "critical" ? "destructive" : "secondary"}
                  className="shrink-0 text-xs"
                >
                  {a.severity === "critical" ? "심각" : "주의"}
                </Badge>
              </span>
              <span className="text-xs text-muted-foreground">
                {a.stallTyCode ? formatStallTypeLabel(a.stallTyCode) : "—"} ·{" "}
                {formatControllerSlotLabel({
                  stallNo: a.stallNo,
                  eqpmnNo: a.eqpmnNo,
                  idx: a.idx,
                })}
              </span>
              <span className="truncate text-xs text-muted-foreground">{a.detail}</span>
              <span className="text-[0.7rem] text-muted-foreground">
                {formatKst(a.occurredAt, "short")}
              </span>
            </DropdownMenuItem>
          ))
        )}
        {count > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center text-emerald-700"
              disabled={isPending}
              onClick={() =>
                navigate("/alarms", { message: "알람 페이지로 이동 중…" })
              }
            >
              {count > preview.length ? `전체 ${count}건 보기` : "알람 페이지로 이동"}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
