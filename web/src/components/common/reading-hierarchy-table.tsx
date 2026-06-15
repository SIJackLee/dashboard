"use client";

import { useMemo, useState } from "react";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { ChevronDown, ChevronRight } from "lucide-react";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { StatusBadge } from "@/components/common/status-badge";
import { EnvChip } from "@/components/common/env-chip";
import { FanIndicator } from "@/components/common/fan-indicator";
import { ControllerNameLabel } from "@/components/common/controller-name-label";
import type { BarnReading } from "@/lib/data/iot";
import { sensorValueForDisplay } from "@/lib/data/reading-display";
import { summarizeReadings } from "@/lib/data/hierarchy-summary";
import { groupReadingsByHierarchy } from "@/lib/data/reading-hierarchy";
import { formatKst } from "@/lib/datetime/kst";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function fmtTime(iso: string): string {
  return formatKst(iso, "short");
}

const fmtNum = (v: number | null, digits = 1) =>
  v === null ? "--" : v.toFixed(digits);

type Props = {
  readings: BarnReading[];
  showModule?: boolean;
  initialExpandedSp?: string;
  /** true — 컨트롤러 행 클릭 시 /controllers 로 이동 */
  linkControllers?: boolean;
};

/** SP → 축사 → 컨트롤러 계층 테이블 (SP 드롭다운 접기/펼치기) */
export function ReadingHierarchyTable({
  readings,
  showModule = true,
  initialExpandedSp,
  linkControllers = false,
}: Props) {
  const groups = useMemo(() => groupReadingsByHierarchy(readings), [readings]);
  const colSpan = showModule ? 7 : 6;

  const [expandedSp, setExpandedSp] = useState<Set<string>>(() => {
    if (initialExpandedSp) return new Set([initialExpandedSp]);
    return new Set();
  });

  const toggleSp = (code: string) => {
    setExpandedSp((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  if (readings.length === 0) {
    return (
      <p className="py-10 text-center text-[1.75rem] text-muted-foreground">
        표시할 데이터가 없습니다.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>축사유형 / 축사 / 컨트롤러</TableHead>
          <TableHead>통신</TableHead>
          <TableHead>온도</TableHead>
          <TableHead>습도</TableHead>
          <TableHead>송풍/배기/입기 (%)</TableHead>
          {showModule && <TableHead>통신박스</TableHead>}
          <TableHead>최근 업데이트</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((sp) => {
          const isOpen = expandedSp.has(sp.stallTyCode);
          const ctrlCount = sp.stalls.reduce(
            (n, s) => n + s.readings.length,
            0
          );
          return (
            <SpGroupRows
              key={sp.stallTyCode}
              sp={sp}
              isOpen={isOpen}
              colSpan={colSpan}
              showModule={showModule}
              ctrlCount={ctrlCount}
              linkControllers={linkControllers}
              onToggle={() => toggleSp(sp.stallTyCode)}
            />
          );
        })}
      </TableBody>
    </Table>
  );
}

function SpGroupRows({
  sp,
  isOpen,
  colSpan,
  showModule,
  ctrlCount,
  linkControllers,
  onToggle,
}: {
  sp: ReturnType<typeof groupReadingsByHierarchy>[number];
  isOpen: boolean;
  colSpan: number;
  showModule: boolean;
  ctrlCount: number;
  linkControllers?: boolean;
  onToggle: () => void;
}) {
  const allReadings = useMemo(
    () => sp.stalls.flatMap((stall) => stall.readings),
    [sp.stalls]
  );
  const summary = useMemo(
    () => summarizeReadings(allReadings),
    [allReadings]
  );

  const labelCell = (
    <span className="inline-flex items-center gap-2 font-semibold">
      {isOpen ? (
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      ) : (
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      )}
      {sp.label}
      <span className="text-xs font-normal text-muted-foreground">
        ({ctrlCount}대)
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
            <TableCell className="py-2">{labelCell}</TableCell>
            <TableCell>
              <StatusBadge tone={summary.status} large />
            </TableCell>
            <TableCell>
              <EnvChip kind="temp" value={fmtNum(summary.tempC)} />
            </TableCell>
            <TableCell>
              <EnvChip kind="humidity" value={fmtNum(summary.humidityPct)} />
            </TableCell>
            <TableCell>
              <div className="flex gap-3">
                <FanIndicator kind="supply" value={summary.fanSupply} compact />
                <FanIndicator kind="exhaust" value={summary.fanExhaust} compact />
                <FanIndicator kind="intake" value={summary.fanIntake} compact />
              </div>
            </TableCell>
            {showModule ? (
              <TableCell className="text-xs text-muted-foreground">—</TableCell>
            ) : null}
            <TableCell className="text-xs text-muted-foreground">
              {summary.latestReceivedAt
                ? fmtTime(summary.latestReceivedAt)
                : "—"}
            </TableCell>
          </>
        )}
      </TableRow>
      {isOpen &&
        sp.stalls.map((stall) => (
            <StallGroupRows
              key={`${sp.stallTyCode}-${stall.stallKey}`}
              stall={stall}
              colSpan={colSpan}
              showModule={showModule}
              linkControllers={linkControllers}
            />
        ))}
    </>
  );
}

function StallGroupRows({
  stall,
  colSpan,
  showModule,
  linkControllers,
}: {
  stall: ReturnType<typeof groupReadingsByHierarchy>[number]["stalls"][number];
  colSpan: number;
  showModule: boolean;
  linkControllers?: boolean;
}) {
  const { navigate, isPending } = useAppNavigate();

  return (
    <>
      <TableRow className="bg-muted/20 hover:bg-muted/20">
        <TableCell
          colSpan={colSpan}
          className="py-1.5 pl-8 text-sm font-medium text-muted-foreground"
        >
          {stall.label}
          <span className="ml-2 text-xs font-normal">
            ({stall.readings.length}대)
          </span>
        </TableCell>
      </TableRow>
      {stall.readings.map((r) => {
        const href = linkControllers
          ? buildControllerHref({
              farmKey: r.farmKey,
              sp: r.stallTyCode,
              stallNo: r.stallNo,
              controllerKey: r.controllerKey,
            })
          : null;

        return (
        <TableRow
          key={r.key}
          className={cn(
            !showModule && "text-sm",
            href && "cursor-pointer hover:bg-muted/40"
          )}
          onClick={
            href && !isPending
              ? () =>
                  navigate(href, { message: "컨트롤러 페이지로 이동 중…" })
              : undefined
          }
          onKeyDown={
            href
              ? (e) => {
                  if (isPending) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(href, { message: "컨트롤러 페이지로 이동 중…" });
                  }
                }
              : undefined
          }
          tabIndex={href ? 0 : undefined}
          role={href ? "link" : undefined}
        >
          <TableCell className="pl-12">
            <ControllerNameLabel
              label={r.label}
              stallNo={r.stallNo}
              eqpmnNo={r.eqpmnNo}
              controllerKey={r.controllerKey}
              idx={r.idx}
            />
          </TableCell>
          <TableCell>
            <StatusBadge tone={r.status} large />
          </TableCell>
          <TableCell>
            <EnvChip
              kind="temp"
              value={fmtNum(sensorValueForDisplay(r.status, r.tempC))}
            />
          </TableCell>
          <TableCell>
            <EnvChip
              kind="humidity"
              value={fmtNum(sensorValueForDisplay(r.status, r.humidityPct))}
            />
          </TableCell>
          <TableCell>
            <div className="flex gap-3">
              <FanIndicator
                kind="supply"
                value={sensorValueForDisplay(r.status, r.fanSupply)}
                compact
              />
              <FanIndicator
                kind="exhaust"
                value={sensorValueForDisplay(r.status, r.fanExhaust)}
                compact
              />
              <FanIndicator
                kind="intake"
                value={sensorValueForDisplay(r.status, r.fanIntake)}
                compact
              />
            </div>
          </TableCell>
          {showModule && (
            <TableCell className="text-xs text-muted-foreground">
              {r.moduleUid}
            </TableCell>
          )}
          <TableCell className="text-xs text-muted-foreground">
            {fmtTime(r.receivedAt)}
          </TableCell>
        </TableRow>
        );
      })}
    </>
  );
}
