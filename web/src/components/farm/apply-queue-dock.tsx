"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  applyQueueCaption,
  applyQueueGauge,
  applyQueueHandleLabel,
  applyQueueStage,
  formatApplyQueueTargetLine,
  type ApplyQueueTicket,
} from "@/lib/farm/apply-queue";
import { applyQueueCommandBinary } from "@/lib/farm/command-wire";
import type { BulkLiveTrackRow } from "@/components/farm/use-bulk-command-pipeline-tracker";
import type { BarnReading } from "@/lib/data/iot";
import { cn } from "@/lib/utils";
import { FEEDBACK_Z } from "@/lib/ui/feedback-layers";
import { dashboardElevation } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";

type Props = {
  rows: BulkLiveTrackRow[];
  readings: BarnReading[];
  open: boolean;
  onToggle: () => void;
};

function ticketOf(row: BulkLiveTrackRow): ApplyQueueTicket {
  return {
    status: row.command.status,
    liveConfirmed: row.liveConfirmed,
  };
}

function ticketTarget(row: BulkLiveTrackRow, readings: BarnReading[]): string {
  const reading = readings.find((item) => item.key === row.key);
  return formatApplyQueueTargetLine({
    stallTyCode: reading?.stallTyCode ?? row.command.stallTyCode,
    stallNo: reading?.stallNo ?? row.command.stallNo,
    eqpmnNo: reading?.eqpmnNo ?? row.command.eqpmnNo,
    channel: row.command.channel,
  });
}

function StageGauge({ ticket }: { ticket: ApplyQueueTicket }) {
  const parts = applyQueueGauge(ticket);
  const cells = [
    ...Array.from({ length: parts.filled }, () => "filled" as const),
    ...Array.from({ length: parts.current }, () => "current" as const),
    ...Array.from({ length: parts.rest }, () => "rest" as const),
  ];
  return (
    <div className="flex h-1.5 gap-0.5" aria-hidden>
      {cells.map((kind, index) => (
        <span
          key={`${kind}-${index}`}
          className={cn(
            "min-w-0 flex-1 rounded-sm",
            kind === "filled" &&
              "bg-[color-mix(in_oklch,var(--status-ok)_55%,transparent)]",
            kind === "current" &&
              (parts.fail
                ? "bg-[color-mix(in_oklch,var(--status-danger)_70%,transparent)]"
                : "bg-[color-mix(in_oklch,var(--channel-command)_65%,transparent)]"),
            kind === "rest" && "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function QueueTicket({
  row,
  readings,
}: {
  row: BulkLiveTrackRow;
  readings: BarnReading[];
}) {
  const ticket = ticketOf(row);
  const binary = applyQueueCommandBinary(row.command);
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-medium leading-snug text-foreground">
          {ticketTarget(row, readings)}
        </p>
        <p
          className={cn(
            "shrink-0 text-xs tabular-nums leading-snug text-muted-foreground",
            applyQueueStage(ticket) === "실패" &&
              "text-[var(--status-danger)]",
            applyQueueStage(ticket) === "확인" &&
              "text-[var(--status-ok)]",
          )}
        >
          {applyQueueCaption(ticket)}
        </p>
      </div>
      {binary ? (
        <p className="break-all font-mono text-[0.65rem] leading-snug tabular-nums text-muted-foreground">
          {binary}
        </p>
      ) : null}
      <StageGauge ticket={ticket} />
    </div>
  );
}

const subscribeNoop = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;

export function ApplyQueueDock({ rows, readings, open, onToggle }: Props) {
  const mounted = useSyncExternalStore(subscribeNoop, clientTrue, serverFalse);
  if (!mounted) return null;

  const tickets = rows.map(ticketOf);
  const handle = applyQueueHandleLabel(tickets);
  const failed = tickets.some((ticket) => applyQueueStage(ticket) === "실패");
  const warnBorder = failed
    ? "border-[color-mix(in_oklch,var(--status-warn)_45%,var(--border))]"
    : null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={cn(
        motionClass.enterSlideUp,
        "fixed bottom-4 left-4 w-[min(calc(100vw-2rem),18.75rem)]",
      )}
      style={{ zIndex: FEEDBACK_Z.liveBanner }}
      data-apply-queue-dock
      data-feedback-layer="live-banner"
    >
      {open ? (
        <div
          className={cn(
            dashboardElevation.float,
            "overflow-hidden bg-background",
            warnBorder,
          )}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-expanded="true"
            className={cn(
              "flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left",
              motionClass.microInteractive,
            )}
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-none text-foreground">
                적용 큐 · 티켓
              </span>
              <span className="mt-1 block text-xs leading-none text-muted-foreground">
                최근 1시간
              </span>
            </span>
            <span className="text-xs leading-none text-muted-foreground">
              접기
            </span>
          </button>
          <div className="max-h-[min(40vh,16rem)] space-y-2 overflow-y-auto border-t border-border px-2.5 py-2">
            {rows.length === 0 ? (
              <p className="text-xs leading-snug text-muted-foreground">
                최근 1시간 명령이 없습니다.
              </p>
            ) : (
              rows.map((row) => (
                <QueueTicket
                  key={row.id}
                  row={row}
                  readings={readings}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded="false"
          className={cn(
            dashboardElevation.float,
            motionClass.microInteractive,
            "flex w-full items-center justify-between gap-2 bg-background px-2.5 py-2 text-left",
            warnBorder,
          )}
        >
          <span className="text-sm font-semibold leading-none text-foreground">
            {handle}
          </span>
          <span className="text-xs leading-none text-muted-foreground">
            {failed ? "주의" : "펼침"}
          </span>
        </button>
      )}
    </div>,
    document.body,
  );
}

/** @deprecated 적용 큐 도크 — 기존 배너 이름 호환 */
export function BulkLiveProgressBanner(props: Props) {
  return <ApplyQueueDock {...props} />;
}
