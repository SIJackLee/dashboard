"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useControllerMeta } from "@/components/controllers/controller-meta-provider";
import type { AlarmRow } from "@/lib/data/alarms";
import type { ControllerReading } from "@/lib/data/iot";
import {
  compareFarmKey,
  farmKeyId,
  type FarmKey,
} from "@/lib/data/farm-key";
import {
  farmShortLabel,
  type FarmSummaryRow,
  uniqueFarmKeysFromReadings,
} from "@/lib/data/farm-summaries";
import {
  groupReadingsByHierarchy,
  stallKeyFromReading,
  stallLabelFromKey,
} from "@/lib/data/reading-hierarchy";
import {
  formatStallTypeLabel,
  normalizeStallTyCode,
} from "@/lib/data/stall-type";
import { formatControllerPillLabel } from "@/lib/ui/controller-labels";
import {
  dashboardTypography,
  dashboardUi,
} from "@/lib/ui/dashboard-page-ui";
import {
  farmHealthTier,
  farmHealthTierLabel,
  type FarmHealthTier,
} from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";

export type ControllerSelectPayload = {
  farmKey: FarmKey;
  spCode: string;
  stallKey: string;
  readingKey: string;
};

type ControllerNode = {
  readingKey: string;
  controllerKey: string;
  label: string;
  alarms: AlarmRow[];
  offline: boolean;
};

type StallNode = {
  stallKey: string;
  label: string;
  controllers: ControllerNode[];
  alarmCount: number;
};

type SpNode = {
  spCode: string;
  label: string;
  stalls: StallNode[];
  alarmCount: number;
};

type FarmNode = {
  farmKey: FarmKey;
  label: string;
  sps: SpNode[];
  alarmCount: number;
  healthTier: FarmHealthTier;
};

function spExpandKey(farmId: string, spCode: string): string {
  return `${farmId}|${spCode}`;
}

function stallExpandKey(
  farmId: string,
  spCode: string,
  stallKey: string
): string {
  return `${farmId}|${spCode}|${stallKey}`;
}

function stallKeyFromAlarm(alarm: AlarmRow): string {
  const stall = alarm.stallNo?.trim();
  if (stall) return stall;
  if (alarm.controllerKey) return `__ck_${alarm.controllerKey}`;
  if (alarm.idx != null) return `__idx_${alarm.idx}`;
  return "__unknown";
}

function sortAlarms(a: AlarmRow, b: AlarmRow): number {
  const rank = (x: AlarmRow) => {
    if (x.severity === "critical") return 0;
    if (x.alarmType === "통신 두절") return 2;
    return 1;
  };
  const bySeverity = rank(a) - rank(b);
  if (bySeverity !== 0) return bySeverity;
  return b.occurredAt.localeCompare(a.occurredAt);
}

function resolveFarmHealth(
  farmKey: FarmKey,
  farmAlarms: AlarmRow[],
  farmReadings: ControllerReading[],
  summaryById: Map<string, FarmSummaryRow>
): FarmHealthTier {
  const summary = summaryById.get(farmKeyId(farmKey));
  if (summary) return farmHealthTier(summary);
  const offlineCount = farmReadings.filter((r) => r.status === "offline").length;
  const criticalCount = farmAlarms.filter((a) => a.severity === "critical").length;
  return farmHealthTier({
    alarmCount: farmAlarms.length,
    criticalCount,
    offlineCount,
  });
}

function buildHierarchyTree(
  readings: ControllerReading[],
  alarms: AlarmRow[],
  farmSummaries: FarmSummaryRow[],
  resolveName: (controllerKey: string, eqpmnNo: string) => string | null
): FarmNode[] {
  const summaryById = new Map(
    farmSummaries.map((s) => [farmKeyId(s.farmKey), s])
  );

  const farmKeys = new Map<string, FarmKey>();
  for (const fk of uniqueFarmKeysFromReadings(readings)) {
    farmKeys.set(farmKeyId(fk), fk);
  }
  for (const s of farmSummaries) {
    farmKeys.set(farmKeyId(s.farmKey), s.farmKey);
  }

  const alarmsByFarm = new Map<string, AlarmRow[]>();
  for (const alarm of alarms) {
    const farmId = farmKeyId(alarm.farmKey);
    const list = alarmsByFarm.get(farmId) ?? [];
    list.push(alarm);
    alarmsByFarm.set(farmId, list);
  }

  const farms: FarmNode[] = [];

  for (const farmKey of [...farmKeys.values()].sort(compareFarmKey)) {
    const farmId = farmKeyId(farmKey);
    const farmReadings = readings.filter(
      (r) => farmKeyId(r.farmKey) === farmId
    );
    const farmAlarms = alarmsByFarm.get(farmId) ?? [];
    const hierarchy = groupReadingsByHierarchy(farmReadings);

    const sps: SpNode[] = hierarchy.map((sp) => {
      const spCode = sp.stallTyCode;
      const spAlarms = farmAlarms.filter(
        (a) =>
          (a.stallTyCode ? normalizeStallTyCode(a.stallTyCode) : "__unknown") ===
          spCode
      );

      const stalls: StallNode[] = sp.stalls.map((stall) => {
        const stallAlarms = spAlarms.filter(
          (a) => stallKeyFromAlarm(a) === stall.stallKey
        );

        const controllers: ControllerNode[] = stall.readings.map((reading) => {
          const ctrlAlarms = stallAlarms
            .filter((a) => a.controllerKey === reading.controllerKey)
            .sort(sortAlarms);
          return {
            readingKey: reading.key,
            controllerKey: reading.controllerKey,
            label: formatControllerPillLabel({
              label: reading.label,
              stallNo: reading.stallNo,
              stallTyCode: reading.stallTyCode,
              eqpmnNo: reading.eqpmnNo,
              displayName: resolveName(
                reading.controllerKey,
                reading.eqpmnNo
              ),
              scopeSpCode: spCode,
              scopeStallKey: stall.stallKey,
            }),
            alarms: ctrlAlarms,
            offline: reading.status === "offline",
          };
        });

        controllers.sort((a, b) =>
          a.label.localeCompare(b.label, "ko", { numeric: true })
        );

        return {
          stallKey: stall.stallKey,
          label: stall.label,
          controllers,
          alarmCount: stallAlarms.length,
        };
      });

      stalls.sort((a, b) =>
        a.stallKey.localeCompare(b.stallKey, "ko", { numeric: true })
      );

      return {
        spCode,
        label: sp.label,
        stalls,
        alarmCount: spAlarms.length,
      };
    });

    farms.push({
      farmKey,
      label: farmShortLabel(farmKey),
      sps,
      alarmCount: farmAlarms.length,
      healthTier: resolveFarmHealth(
        farmKey,
        farmAlarms,
        farmReadings,
        summaryById
      ),
    });
  }

  return farms;
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge
      variant="secondary"
      className={cn("shrink-0 tabular-nums", dashboardTypography.badge)}
    >
      {count}
    </Badge>
  );
}

function l0HealthChipClass(open: boolean, tier: FarmHealthTier) {
  const tierCls = {
    normal:
      "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-800/50 dark:bg-emerald-950/30",
    warning:
      "border-amber-300/70 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/30",
    danger:
      "border-red-300/70 bg-red-50/60 dark:border-red-800/50 dark:bg-red-950/30",
  }[tier];

  const labelCls = {
    normal: "text-emerald-700 dark:text-emerald-400",
    warning: "text-amber-700 dark:text-amber-400",
    danger: "text-red-700 dark:text-red-400",
  }[tier];

  return {
    chip: cn(
      "flex w-full min-w-0 items-center gap-3 rounded-xl border px-4 py-3 text-left font-semibold transition-colors",
      dashboardUi.scopePillText,
      tierCls,
      open
        ? "ring-2 ring-primary/40"
        : "hover:brightness-[0.98] dark:hover:brightness-110"
    ),
    label: labelCls,
  };
}

function chipClass(
  selected: boolean,
  level: 1 | 2 | 3,
  open = false
) {
  const base = cn(
    "flex w-full min-w-0 items-center gap-2 border text-left transition-colors",
    dashboardUi.scopePillText
  );
  const stateCls = selected
    ? dashboardUi.scopePillActive
    : open
      ? "border-primary/50 bg-primary/5"
      : cn(dashboardUi.scopePillIdle, "bg-background");

  switch (level) {
    case 1:
      return cn(base, stateCls, "rounded-xl px-4 py-2.5 font-medium");
    case 2:
      return cn(
        base,
        stateCls,
        "rounded-xl px-3.5 py-2 font-medium text-muted-foreground"
      );
    case 3:
      return cn(base, stateCls, "rounded-xl px-3.5 py-2.5 font-medium");
  }
}

type Props = {
  alarms: AlarmRow[];
  readings: ControllerReading[];
  farmSummaries?: FarmSummaryRow[];
  selectedControllerKey?: string;
  onControllerSelect: (payload: ControllerSelectPayload) => void;
};

/** 권한 내 농장목록 — L0 배경 채색, 축사 하위 컨트롤러 칩으로 제어 */
export function HierarchyAlarmTree({
  alarms,
  readings,
  farmSummaries = [],
  selectedControllerKey,
  onControllerSelect,
}: Props) {
  const { resolveName } = useControllerMeta();
  const tree = useMemo(
    () => buildHierarchyTree(readings, alarms, farmSummaries, resolveName),
    [readings, alarms, farmSummaries, resolveName]
  );

  const [expandedFarms, setExpandedFarms] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedSps, setExpandedSps] = useState<Set<string>>(() => new Set());
  const [expandedStalls, setExpandedStalls] = useState<Set<string>>(
    () => new Set()
  );

  const expandToReading = useCallback((reading: ControllerReading) => {
    const farmId = farmKeyId(reading.farmKey);
    const spCode = reading.stallTyCode
      ? normalizeStallTyCode(reading.stallTyCode)
      : "__unknown";
    const stallKey = stallKeyFromReading(reading);
    setExpandedFarms((prev) => new Set(prev).add(farmId));
    setExpandedSps((prev) =>
      new Set(prev).add(spExpandKey(farmId, spCode))
    );
    setExpandedStalls((prev) =>
      new Set(prev).add(stallExpandKey(farmId, spCode, stallKey))
    );
  }, []);

  useEffect(() => {
    if (!selectedControllerKey) return;
    const reading = readings.find((r) => r.key === selectedControllerKey);
    if (reading) expandToReading(reading);
  }, [selectedControllerKey, readings, expandToReading]);

  const toggleFarm = (farmId: string) => {
    setExpandedFarms((prev) => {
      const next = new Set(prev);
      if (next.has(farmId)) {
        next.delete(farmId);
        const prefix = `${farmId}|`;
        setExpandedSps((sps) =>
          new Set([...sps].filter((k) => !k.startsWith(prefix)))
        );
        setExpandedStalls((stalls) =>
          new Set([...stalls].filter((k) => !k.startsWith(prefix)))
        );
      } else {
        next.add(farmId);
      }
      return next;
    });
  };

  const toggleSp = (farmId: string, spCode: string) => {
    const key = spExpandKey(farmId, spCode);
    setExpandedSps((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        const stallPrefix = `${key}|`;
        setExpandedStalls((stalls) =>
          new Set([...stalls].filter((k) => !k.startsWith(stallPrefix)))
        );
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleStall = (farmId: string, spCode: string, stallKey: string) => {
    const key = stallExpandKey(farmId, spCode, stallKey);
    setExpandedStalls((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (tree.length === 0) {
    return (
      <p className={cn("text-muted-foreground", dashboardUi.body)}>
        표시할 농장이 없습니다
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {tree.map((farm) => {
        const farmId = farmKeyId(farm.farmKey);
        const farmOpen = expandedFarms.has(farmId);
        const l0 = l0HealthChipClass(farmOpen, farm.healthTier);

        return (
          <section key={farmId} className="space-y-2">
            <button
              type="button"
              onClick={() => toggleFarm(farmId)}
              className={l0.chip}
            >
              <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                {farm.label}
              </span>
              <span
                className={cn(
                  "shrink-0 font-semibold",
                  dashboardTypography.badge,
                  l0.label
                )}
              >
                {farmHealthTierLabel(farm.healthTier)}
              </span>
              <CountBadge count={farm.alarmCount} />
            </button>

            {farmOpen ? (
              farm.sps.length === 0 ? (
                <p className={cn("pl-3 text-muted-foreground", dashboardUi.body)}>
                  등록된 컨트롤러 없음
                </p>
              ) : (
                farm.sps.map((sp) => {
                  const spKey = spExpandKey(farmId, sp.spCode);
                  const spOpen = expandedSps.has(spKey);

                  return (
                    <div key={spKey} className="space-y-2 pl-3">
                      <button
                        type="button"
                        onClick={() => toggleSp(farmId, sp.spCode)}
                        className={chipClass(false, 1, spOpen)}
                      >
                        <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                          {sp.label}
                        </span>
                        <CountBadge count={sp.alarmCount} />
                      </button>

                      {spOpen
                        ? sp.stalls.map((stall) => {
                            const stallKey = stallExpandKey(
                              farmId,
                              sp.spCode,
                              stall.stallKey
                            );
                            const stallOpen = expandedStalls.has(stallKey);

                            return (
                              <div key={stallKey} className="space-y-2 pl-4">
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleStall(
                                      farmId,
                                      sp.spCode,
                                      stall.stallKey
                                    )
                                  }
                                  className={chipClass(false, 2, stallOpen)}
                                >
                                  <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                                    {stall.label}
                                  </span>
                                  <CountBadge count={stall.alarmCount} />
                                </button>

                                {stallOpen ? (
                                  stall.controllers.length > 0 ? (
                                    <div className="flex flex-col gap-2 pl-4">
                                      {stall.controllers.map((ctrl) => (
                                        <button
                                          key={ctrl.readingKey}
                                          type="button"
                                          onClick={() =>
                                            onControllerSelect({
                                              farmKey: farm.farmKey,
                                              spCode: sp.spCode,
                                              stallKey: stall.stallKey,
                                              readingKey: ctrl.readingKey,
                                            })
                                          }
                                          className={chipClass(
                                            selectedControllerKey ===
                                              ctrl.readingKey,
                                            3
                                          )}
                                        >
                                          <span className="min-w-0 flex-1 truncate whitespace-nowrap">
                                            {ctrl.label}
                                          </span>
                                          {ctrl.offline ? (
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                "shrink-0",
                                                dashboardTypography.badge
                                              )}
                                            >
                                              오프라인
                                            </Badge>
                                          ) : null}
                                          <CountBadge count={ctrl.alarms.length} />
                                        </button>
                                      ))}
                                    </div>
                                  ) : (
                                    <p
                                      className={cn(
                                        "pl-4 text-muted-foreground",
                                        dashboardUi.body
                                      )}
                                    >
                                      컨트롤러 없음
                                    </p>
                                  )
                                ) : null}
                              </div>
                            );
                          })
                        : null}
                    </div>
                  );
                })
              )
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
