"use client";

import { Badge } from "@/components/ui/badge";
import type { AlarmRow } from "@/lib/data/alarms";
import { farmKeyId } from "@/lib/data/farm-key";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

function severityLabel(alarm: AlarmRow): string {
  if (alarm.alarmType === "통신 두절") return "통신";
  if (alarm.severity === "critical") return "심각";
  return "주의";
}

function severityVariant(alarm: AlarmRow): "destructive" | "secondary" | "outline" {
  if (alarm.alarmType === "통신 두절") return "outline";
  if (alarm.severity === "critical") return "destructive";
  return "secondary";
}

type Props = {
  alarms: AlarmRow[];
  selectedId?: string;
  onAlarmSelect: (alarm: AlarmRow) => void;
};

/** 권한 내 전역 이상상황 — 컴팩트 칩 랩 (#4) */
export function FarmWideAlarmChips({ alarms, selectedId, onAlarmSelect }: Props) {
  if (alarms.length === 0) {
    return (
      <p className={cn("text-muted-foreground", dashboardUi.body)}>
        활성 이상 알람 없음
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {alarms.map((alarm) => {
        const selected = selectedId === alarm.id;
        return (
          <button
            key={alarm.id}
            type="button"
            onClick={() => onAlarmSelect(alarm)}
            className={cn(
              "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 transition-colors",
              dashboardTypography.badge,
              selected
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border bg-background hover:bg-muted"
            )}
          >
            <span className="shrink-0 font-semibold tabular-nums">
              {farmKeyId(alarm.farmKey)}
            </span>
            <span className="truncate">{alarm.alarmType}</span>
            <Badge variant={severityVariant(alarm)} className="shrink-0 text-xs">
              {severityLabel(alarm)}
            </Badge>
          </button>
        );
      })}
    </div>
  );
}
