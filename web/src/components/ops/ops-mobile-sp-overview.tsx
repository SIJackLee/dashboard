"use client";

import { WifiOff } from "lucide-react";
import type { AlarmRow } from "@/lib/data/alarms";
import type { ControllerReading } from "@/lib/data/iot";
import type { StatusTone } from "@/components/common/status-badge";
import { farmKeyId } from "@/lib/data/farm-key";
import {
  formatStallTypeLabel,
  formatStallTypeLabelCompact,
  normalizeStallTyCode,
} from "@/lib/data/stall-type";
import { cn } from "@/lib/utils";

type Props = {
  readings: ControllerReading[];
  selectedSpCode?: string;
  onSelectSp: (spCode: string) => void;
};

const STATUS_ARIA: Record<StatusTone, string> = {
  normal: "정상",
  caution: "주의",
  warning: "경고",
  offline: "오프라인",
};

function groupReadingsBySp(readings: ControllerReading[]) {
  const groups = new Map<string, ControllerReading[]>();
  for (const r of readings) {
    const sp = normalizeStallTyCode(r.stallTyCode);
    if (!sp || sp === "UNK") continue;
    const list = groups.get(sp) ?? [];
    list.push(r);
    groups.set(sp, list);
  }
  return groups;
}

function statusRank(tone: StatusTone): number {
  if (tone === "offline") return 1;
  if (tone === "caution") return 2;
  return 10;
}

export type SpNavItem = {
  spCode: string;
  label: string;
  alarmCount: number;
  rank: number;
};

function spNavItemFromGroup(
  spCode: string,
  list: ControllerReading[],
  alarms: AlarmRow[],
  farmId?: string
): SpNavItem {
  const tone = groupWorstStatus(list);
  const alarmCount = alarms.filter(
    (a) =>
      (!farmId || farmKeyId(a.farmKey) === farmId) &&
      normalizeStallTyCode(a.stallTyCode) === spCode
  ).length;
  const rank = alarmCount > 0 ? 0 : statusRank(tone);
  return {
    spCode,
    label: formatStallTypeLabelCompact(spCode),
    alarmCount,
    rank,
  };
}

function sortSpNavItems(items: SpNavItem[]): SpNavItem[] {
  return [...items].sort((a, b) =>
    formatStallTypeLabel(a.spCode).localeCompare(
      formatStallTypeLabel(b.spCode),
      "ko"
    )
  );
}

/** 축사유형 라벨 순 — farmer 좌우 flick·prev/next */
export function buildSpNavQueue(
  readings: ControllerReading[],
  alarms: AlarmRow[],
  farmId?: string
): SpNavItem[] {
  const scoped = farmId
    ? readings.filter((r) => farmKeyId(r.farmKey) === farmId)
    : readings;
  const groups = groupReadingsBySp(scoped);
  return sortSpNavItems(
    [...groups.entries()].map(([sp, list]) =>
      spNavItemFromGroup(sp, list, alarms, farmId)
    )
  );
}

/** 이상·오프라인 우선 — farmer 초기 자동 선택 */
export function buildSpTriageQueue(
  readings: ControllerReading[],
  alarms: AlarmRow[],
  farmId?: string
): SpNavItem[] {
  return buildSpNavQueue(readings, alarms, farmId)
    .filter((item) => item.rank < 10 || item.alarmCount > 0)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.alarmCount !== b.alarmCount) return b.alarmCount - a.alarmCount;
      return a.label.localeCompare(b.label, "ko");
    });
}

function groupWorstStatus(list: ControllerReading[]): StatusTone {
  if (list.some((r) => r.status === "offline")) return "offline";
  if (list.some((r) => r.status === "caution")) return "caution";
  const first = list[0]?.status;
  if (first === "normal" || first === "caution" || first === "offline") {
    return first;
  }
  return "offline";
}

function SpStatusTrailing({
  tone,
  count,
}: {
  tone: StatusTone;
  count: number;
}) {
  if (tone === "offline") {
    return (
      <WifiOff
        className="size-3.5 shrink-0 text-muted-foreground"
        aria-hidden
      />
    );
  }
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-bold tabular-nums leading-none",
        tone === "caution" ? "text-amber-700 dark:text-amber-400" : "text-foreground"
      )}
      aria-hidden
    >
      {count}
    </span>
  );
}

export function OpsMobileSpOverview({
  readings,
  selectedSpCode,
  onSelectSp,
}: Props) {
  const groups = groupReadingsBySp(readings);

  const items = [...groups.entries()].sort((a, b) =>
    formatStallTypeLabel(a[0]).localeCompare(formatStallTypeLabel(b[0]), "ko")
  );

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed bg-muted/20 p-4">
        <p className="text-center text-sm text-muted-foreground">
          축사 데이터가 없습니다. LIVE 수신 후 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-muted/10 p-2">
      <div className="grid grid-cols-2 gap-1.5 min-[400px]:grid-cols-3 min-[400px]:gap-2">
        {items.map(([sp, list]) => {
          const tone = groupWorstStatus(list);
          const isOffline = tone === "offline";
          const active = normalizeStallTyCode(selectedSpCode) === sp;
          const labelFull = formatStallTypeLabel(sp);
          const label = formatStallTypeLabelCompact(sp);
          return (
            <button
              key={sp}
              type="button"
              onClick={() => onSelectSp(sp)}
              aria-label={`${labelFull}, ${STATUS_ARIA[tone]}, ${list.length}대`}
              aria-pressed={active}
              className={cn(
                "flex min-h-11 items-center rounded-lg border px-2 py-2 text-left transition-colors",
                isOffline && !active &&
                  "border-dashed border-border/80 bg-muted/40 opacity-[0.88] hover:bg-muted/50",
                isOffline && active &&
                  "border-dashed border-emerald-500 bg-emerald-50/90 opacity-100 dark:bg-emerald-950/30",
                !isOffline && !active &&
                  "border-border bg-background hover:bg-muted/30",
                !isOffline && active && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
              )}
            >
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <span
                  className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight"
                  title={labelFull !== label ? labelFull : undefined}
                >
                  {label}
                </span>
                <SpStatusTrailing tone={tone} count={list.length} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function pickReadingForSp(
  readings: ControllerReading[],
  spCode: string,
  farmId?: string
): ControllerReading | undefined {
  const sp = normalizeStallTyCode(spCode);
  const scope = readings.filter((r) => {
    if (farmId && farmKeyId(r.farmKey) !== farmId) return false;
    return normalizeStallTyCode(r.stallTyCode) === sp;
  });
  return (
    scope.find((r) => r.status === "offline") ??
    scope.find((r) => r.status === "caution") ??
    scope[0]
  );
}
