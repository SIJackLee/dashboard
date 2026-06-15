"use client";

import Link from "next/link";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { ControllerNameLabel } from "@/components/common/controller-name-label";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { formatKst } from "@/lib/datetime/kst";
import type { AlarmRow } from "@/lib/data/alarms";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { farmLabel } from "@/lib/data/farm-summaries";
import { groupReadingsByHierarchy } from "@/lib/data/reading-hierarchy";
import type { BarnReading } from "@/lib/data/iot";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { summarizeAlarms } from "@/lib/data/hierarchy-summary";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function alarmToReading(a: AlarmRow): BarnReading {
  return {
    key: a.id,
    farmKey: a.farmKey,
    moduleUid: a.moduleUid,
    controllerKey: a.controllerKey,
    idx: a.idx,
    eqpmnNo: a.eqpmnNo,
    stallNo: a.stallNo,
    stallTyCode: a.stallTyCode,
    label: "",
    tempC: null,
    humidityPct: null,
    fanSupply: null,
    fanExhaust: null,
    fanIntake: null,
    fanSupplySeries: [],
    fanExhaustSeries: [],
    fanIntakeSeries: [],
    mesureDt: null,
    receivedAt: a.occurredAt,
    status: a.controllerStatus,
    packetMode: "live",
    wireVer: null,
  };
}

function groupAlarmsByHierarchy(alarms: AlarmRow[]) {
  const byKey = new Map(alarms.map((a) => [a.id, a]));
  const groups = groupReadingsByHierarchy(alarms.map(alarmToReading));
  return groups.map((sp) => ({
    ...sp,
    stalls: sp.stalls.map((stall) => ({
      ...stall,
      alarms: stall.readings
        .map((r) => byKey.get(r.key))
        .filter((a): a is AlarmRow => !!a),
    })),
  }));
}

type AlarmSpGroup = ReturnType<typeof groupAlarmsByHierarchy>[number];

type AlarmFarmGroup = {
  farmId: string;
  farmKey: FarmKey;
  spGroups: AlarmSpGroup[];
};

function groupAlarmsByFarm(alarms: AlarmRow[]): AlarmFarmGroup[] {
  const byFarm = new Map<string, AlarmRow[]>();
  for (const alarm of alarms) {
    const id = farmKeyId(alarm.farmKey);
    const list = byFarm.get(id) ?? [];
    list.push(alarm);
    byFarm.set(id, list);
  }

  return [...byFarm.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([farmId, farmAlarms]) => ({
      farmId,
      farmKey: farmAlarms[0]!.farmKey,
      spGroups: groupAlarmsByHierarchy(farmAlarms),
    }));
}

export function AlarmTable({
  alarms,
  selectedId,
  initialExpandedSp,
  groupByFarm = false,
}: {
  alarms: AlarmRow[];
  selectedId?: string;
  initialExpandedSp?: string;
  groupByFarm?: boolean;
}) {
  const spGroups = useMemo(() => groupAlarmsByHierarchy(alarms), [alarms]);
  const farmGroups = useMemo(
    () => (groupByFarm ? groupAlarmsByFarm(alarms) : []),
    [alarms, groupByFarm]
  );
  const colSpan = 5;

  const [expandedSp, setExpandedSp] = useState<Set<string>>(() =>
    initialExpandedSp ? new Set([initialExpandedSp]) : new Set()
  );
  const [expandedFarm, setExpandedFarm] = useState<Set<string>>(() => {
    if (!groupByFarm) return new Set();
    return new Set(groupAlarmsByFarm(alarms).map((farm) => farm.farmId));
  });

  const toggleSp = (key: string) => {
    setExpandedSp((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleFarm = (farmId: string) => {
    setExpandedFarm((prev) => {
      const next = new Set(prev);
      if (next.has(farmId)) next.delete(farmId);
      else next.add(farmId);
      return next;
    });
  };

  const description = groupByFarm
    ? "농장 → 축사유형 → 축사 → 컨트롤러 순 · LIVE 기준"
    : "축사유형 → 축사 → 컨트롤러 순 · LIVE 기준";

  return (
    <SectionCard title="알람 목록" description={description}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>시간</TableHead>
            <TableHead>
              {groupByFarm ? "농장 / 축사유형 / 축사 / 컨트롤러" : "축사유형 / 축사 / 컨트롤러"}
            </TableHead>
            <TableHead>알람유형</TableHead>
            <TableHead>심각도</TableHead>
            <TableHead>상세</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {alarms.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                활성 알람 없음
              </TableCell>
            </TableRow>
          ) : groupByFarm ? (
            farmGroups.map((farm) => (
              <AlarmFarmGroupRows
                key={farm.farmId}
                farm={farm}
                colSpan={colSpan}
                selectedId={selectedId}
                isOpen={expandedFarm.has(farm.farmId)}
                onToggleFarm={() => toggleFarm(farm.farmId)}
                expandedSp={expandedSp}
                onToggleSp={toggleSp}
              />
            ))
          ) : (
            spGroups.map((sp) => (
              <AlarmSpGroupRows
                key={sp.stallTyCode}
                sp={sp}
                colSpan={colSpan}
                selectedId={selectedId}
                isOpen={expandedSp.has(sp.stallTyCode)}
                onToggle={() => toggleSp(sp.stallTyCode)}
              />
            ))
          )}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

function AlarmFarmGroupRows({
  farm,
  colSpan,
  selectedId,
  isOpen,
  onToggleFarm,
  expandedSp,
  onToggleSp,
}: {
  farm: AlarmFarmGroup;
  colSpan: number;
  selectedId?: string;
  isOpen: boolean;
  onToggleFarm: () => void;
  expandedSp: Set<string>;
  onToggleSp: (key: string) => void;
}) {
  const allAlarms = useMemo(
    () =>
      farm.spGroups.flatMap((sp) => sp.stalls.flatMap((stall) => stall.alarms)),
    [farm.spGroups]
  );
  const summary = useMemo(() => summarizeAlarms(allAlarms), [allAlarms]);
  const avgSeverity =
    allAlarms.length > 0
      ? (summary.criticalCount * 2 + summary.warningCount) / allAlarms.length
      : null;

  const labelCell = (
    <span className="inline-flex items-center gap-2 font-semibold">
      {isOpen ? (
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      )}
      {farmLabel(farm.farmKey)}
      <span className="text-xs font-normal text-muted-foreground">
        ({allAlarms.length}건
        {summary.criticalCount > 0 ? ` · 심각 ${summary.criticalCount}` : ""})
      </span>
    </span>
  );

  return (
    <>
      <TableRow
        className="cursor-pointer bg-muted/60 hover:bg-muted/80"
        onClick={onToggleFarm}
      >
        {isOpen ? (
          <TableCell colSpan={colSpan} className="py-2">
            {labelCell}
          </TableCell>
        ) : (
          <>
            <TableCell className="text-xs text-muted-foreground">
              {summary.latestOccurredAt
                ? formatKst(summary.latestOccurredAt, "short")
                : "—"}
            </TableCell>
            <TableCell className="py-2">{labelCell}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {summary.dominantAlarmType ?? "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {avgSeverity != null ? (
                <span>
                  평균 {avgSeverity.toFixed(1)}
                  <span className="ml-1.5 text-xs">
                    (심각 {summary.criticalCount}·주의 {summary.warningCount})
                  </span>
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">—</TableCell>
          </>
        )}
      </TableRow>
      {isOpen &&
        farm.spGroups.map((sp) => {
          const spKey = `${farm.farmId}:${sp.stallTyCode}`;
          return (
            <AlarmSpGroupRows
              key={spKey}
              sp={sp}
              colSpan={colSpan}
              selectedId={selectedId}
              isOpen={expandedSp.has(spKey)}
              onToggle={() => onToggleSp(spKey)}
              indent={1}
            />
          );
        })}
    </>
  );
}

function AlarmSpGroupRows({
  sp,
  colSpan,
  selectedId,
  isOpen,
  onToggle,
  indent = 0,
}: {
  sp: AlarmSpGroup;
  colSpan: number;
  selectedId?: string;
  isOpen: boolean;
  onToggle: () => void;
  indent?: number;
}) {
  const allAlarms = useMemo(
    () => sp.stalls.flatMap((stall) => stall.alarms),
    [sp.stalls]
  );
  const alarmCount = allAlarms.length;
  const summary = useMemo(() => summarizeAlarms(allAlarms), [allAlarms]);

  const avgSeverity =
    alarmCount > 0
      ? (summary.criticalCount * 2 + summary.warningCount) / alarmCount
      : null;

  const padClass =
    indent === 0 ? "" : indent === 1 ? "pl-6" : `pl-${6 + indent * 4}`;

  const labelCell = (
    <span className={cn("inline-flex items-center gap-2 font-semibold", padClass)}>
      {isOpen ? (
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      )}
      {formatStallTypeLabel(sp.stallTyCode)}
      <span className="text-xs font-normal text-muted-foreground">
        ({alarmCount}건)
      </span>
    </span>
  );

  return (
    <>
      <TableRow
        className="cursor-pointer bg-muted/50 hover:bg-muted/70"
        onClick={onToggle}
      >
        {isOpen ? (
          <TableCell colSpan={colSpan} className="py-2">
            {labelCell}
          </TableCell>
        ) : (
          <>
            <TableCell className="text-xs text-muted-foreground">
              {summary.latestOccurredAt
                ? formatKst(summary.latestOccurredAt, "short")
                : "—"}
            </TableCell>
            <TableCell className="py-2">{labelCell}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {summary.dominantAlarmType ?? "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {avgSeverity != null ? (
                <span>
                  평균 {avgSeverity.toFixed(1)}
                  <span className="ml-1.5 text-xs">
                    (심각 {summary.criticalCount}·주의 {summary.warningCount})
                  </span>
                </span>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">—</TableCell>
          </>
        )}
      </TableRow>
      {isOpen &&
        sp.stalls.map((stall) => (
          <Fragment key={`${sp.stallTyCode}-${stall.stallKey}`}>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableCell
                colSpan={colSpan}
                className={cn(
                  "py-1.5 text-sm font-medium text-muted-foreground",
                  indent === 0 ? "pl-8" : "pl-12"
                )}
              >
                {stall.label}
                <span className="ml-2 text-xs font-normal">
                  ({stall.alarms.length}건)
                </span>
              </TableCell>
            </TableRow>
            {stall.alarms.map((a) => (
              <TableRow
                key={a.id}
                className={cn(
                  "cursor-pointer",
                  selectedId === a.id && "bg-primary/5"
                )}
              >
                <TableCell className="text-xs text-muted-foreground">
                  <Link href={`/alarms?alarm=${encodeURIComponent(a.id)}`} className="block">
                    {formatKst(a.occurredAt, "short")}
                  </Link>
                </TableCell>
                <TableCell className={indent === 0 ? "pl-12" : "pl-16"}>
                  <AppNavLink
                    href={buildControllerHref({
                      farmKey: a.farmKey,
                      sp: a.stallTyCode,
                      ctrlIdx: a.idx,
                    })}
                    message="컨트롤러 페이지로 이동 중…"
                    className="block hover:text-emerald-700 hover:underline"
                  >
                    <ControllerNameLabel
                      stallNo={a.stallNo}
                      eqpmnNo={a.eqpmnNo}
                      controllerKey={a.controllerKey}
                      idx={a.idx}
                    />
                  </AppNavLink>
                </TableCell>
                <TableCell>
                  <Link href={`/alarms?alarm=${encodeURIComponent(a.id)}`} className="block">
                    {a.alarmType}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/alarms?alarm=${encodeURIComponent(a.id)}`} className="block">
                    <Badge
                      variant={
                        a.severity === "critical" ? "destructive" : "secondary"
                      }
                      className={dashboardUi.badgeMd}
                    >
                      {a.severity === "critical" ? "심각" : "주의"}
                    </Badge>
                  </Link>
                </TableCell>
                <TableCell className="text-sm">
                  <Link href={`/alarms?alarm=${encodeURIComponent(a.id)}`} className="block">
                    {a.detail}
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
    </>
  );
}
