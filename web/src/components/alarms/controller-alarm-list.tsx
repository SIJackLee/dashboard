"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatKst } from "@/lib/datetime/kst";
import type { AlarmRow } from "@/lib/data/alarms";
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
  onAlarmSelect?: (alarmId: string) => void;
  /** compact: 좁은 사이드 · page: 대시보드 본문 스케일 */
  typography?: "compact" | "page";
};

/** 선택 컨트롤러 scope — flat 4열 (hierarchy 없음) */
export function ControllerAlarmList({
  alarms,
  selectedId,
  onAlarmSelect,
  typography = "compact",
}: Props) {
  const pageScale = typography === "page";

  if (alarms.length === 0) {
    return (
      <p
        className={cn(
          "text-muted-foreground",
          pageScale ? dashboardUi.body : dashboardUi.opsSideBody
        )}
      >
        활성 이상 알람 없음
      </p>
    );
  }

  return (
    <Table className={pageScale ? dashboardUi.table : undefined}>
      <TableHeader>
        <TableRow>
          <TableHead
            className={
              pageScale ? dashboardUi.tableHead : dashboardUi.opsSideTableHead
            }
          >
            유형
          </TableHead>
          <TableHead
            className={
              pageScale ? dashboardUi.tableHead : dashboardUi.opsSideTableHead
            }
          >
            심각
          </TableHead>
          <TableHead
            className={
              pageScale ? dashboardUi.tableHead : dashboardUi.opsSideTableHead
            }
          >
            상세
          </TableHead>
          <TableHead
            className={
              pageScale ? dashboardUi.tableHead : dashboardUi.opsSideTableHead
            }
          >
            시각
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {alarms.map((alarm) => (
          <TableRow
            key={alarm.id}
            className={cn(
              onAlarmSelect && "cursor-pointer",
              selectedId === alarm.id && "bg-primary/5"
            )}
            onClick={onAlarmSelect ? () => onAlarmSelect(alarm.id) : undefined}
          >
            <TableCell
              className={
                pageScale ? dashboardUi.table : dashboardUi.opsSideTableCell
              }
            >
              {alarm.alarmType}
            </TableCell>
            <TableCell>
              <Badge
                variant={severityVariant(alarm)}
                className={pageScale ? dashboardTypography.badge : "text-xs"}
              >
                {severityLabel(alarm)}
              </Badge>
            </TableCell>
            <TableCell
              className={cn(
                pageScale ? dashboardUi.table : dashboardUi.opsSideTableCell,
                pageScale ? "max-w-[16rem] truncate" : "max-w-[8rem] truncate"
              )}
              title={alarm.detail}
            >
              {alarm.detail}
            </TableCell>
            <TableCell
              className={
                pageScale ? dashboardUi.tableMeta : dashboardUi.opsSideMeta
              }
            >
              {formatKst(alarm.occurredAt, "short")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
