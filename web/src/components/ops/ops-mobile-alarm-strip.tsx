"use client";

import type { AlarmRow } from "@/lib/data/alarms";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  alarms: AlarmRow[];
  activeAlarmId?: string | null;
  onSelect: (alarm: AlarmRow) => void;
  maxItems?: number;
  /** false — 전체 알람 좌우 flick */
  limitVisible?: boolean;
  density?: "default" | "compact";
  /** 분할 셸 내부 — lg:hidden 미적용 */
  embedded?: boolean;
};

function severityClass(alarm: AlarmRow): string {
  if (alarm.severity === "critical") return "border-red-300/60 bg-red-50/80";
  if (alarm.alarmType === "통신 두절") return "border-muted-foreground/30 bg-muted/30";
  return "border-amber-300/50 bg-amber-50/70";
}

export function OpsMobileAlarmStrip({
  alarms,
  activeAlarmId,
  onSelect,
  maxItems = 4,
  limitVisible = true,
  density = "default",
  embedded = false,
}: Props) {
  if (alarms.length === 0) return null;

  const compact = density === "compact";
  const visible = limitVisible
    ? alarms.slice(0, compact ? Math.min(maxItems, 3) : maxItems)
    : alarms;
  const rest = limitVisible ? alarms.length - visible.length : 0;

  return (
    <section
      className={cn(compact ? "space-y-1" : "space-y-1.5", !embedded && "lg:hidden")}
      aria-label="이상 알람 빠른 이동"
    >
      {!compact ? (
        <div className="flex items-center justify-between gap-2">
          <p className={cn(dashboardTypography.sectionTitle, "text-base md:text-lg")}>
            이상 알람
          </p>
          <span className={cn(dashboardUi.badgeMd, "text-xs")}>{alarms.length}건</span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 px-0.5">
          <p className="text-[11px] font-semibold text-muted-foreground">이상 알람</p>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {alarms.length}
          </span>
        </div>
      )}
      <div
        className={cn(
          "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]",
          compact ? "gap-1 pb-0" : "gap-1.5 pb-0.5"
        )}
      >
        {visible.map((alarm) => {
          const active = alarm.id === activeAlarmId;
          return (
            <button
              key={alarm.id}
              type="button"
              onClick={() => onSelect(alarm)}
              className={cn(
                "shrink-0 snap-start border text-left transition-colors",
                compact
                  ? "max-h-10 min-h-9 min-w-[7.5rem] rounded-md px-1.5 py-1"
                  : "min-w-[11rem] rounded-xl px-3 py-2.5",
                severityClass(alarm),
                active &&
                  (compact
                    ? "border-emerald-500 bg-emerald-50/80"
                    : "ring-2 ring-emerald-500 ring-offset-1")
              )}
            >
              <p
                className={cn(
                  "truncate font-semibold leading-none",
                  compact ? "text-[11px]" : "text-sm"
                )}
              >
                {alarm.alarmType}
              </p>
              <p
                className={cn(
                  "truncate leading-none text-muted-foreground",
                  compact ? "mt-0.5 text-[9px]" : "mt-0.5 text-[10px] md:text-xs"
                )}
              >
                {alarm.controllerKey}
              </p>
            </button>
          );
        })}
        {rest > 0 ? (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center border bg-muted/20 text-muted-foreground",
              compact
                ? "min-h-9 min-w-[2.5rem] rounded-md px-1.5 text-[10px]"
                : "min-w-[4rem] rounded-xl px-2 text-xs"
            )}
          >
            +{rest}
          </div>
        ) : null}
      </div>
    </section>
  );
}
