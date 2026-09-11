"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import {
  dashboardAffordance,
  dashboardChroma,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import { cn } from "@/lib/utils";
import type { TrendEventLane, TrendEventMark } from "@/lib/data/trend-chart-types";
import { X_SCOPE_DRAG_PX } from "./trend-chart-geometry";

export type PositionedEventMark = {
  mark: TrendEventMark;
  xView: number;
  yView: number;
};

function markDotClass(mark: TrendEventMark, selected: boolean): string {
  const fill =
    mark.tone === "ok"
      ? "bg-[var(--status-ok)] border-[color-mix(in_oklch,var(--status-ok)_40%,var(--background))]"
      : mark.infoStrength === 3
        ? "bg-[color-mix(in_oklch,var(--channel-command)_80%,transparent)] border-background"
        : mark.infoStrength === 2
          ? "bg-[color-mix(in_oklch,var(--channel-command)_55%,transparent)] border-background"
          : "bg-[color-mix(in_oklch,var(--channel-command)_35%,transparent)] border-background";
  return cn(
    "block rounded-full border size-1.5",
    fill,
    selected &&
      (mark.tone === "ok"
        ? "ring-1 ring-[color:var(--status-ok-ink)]"
        : "ring-1 ring-foreground"),
  );
}

export function EventLaneSvgGuides({
  padL,
  padR,
  viewW,
  laneTop,
  laneH,
  rowCount,
}: {
  padL: number;
  padR: number;
  viewW: number;
  laneTop: number;
  laneH: number;
  rowCount: number;
}) {
  const rows = Math.max(1, rowCount);
  const x2 = viewW - padR;
  return (
    <g aria-hidden>
      <line
        x1={padL}
        x2={x2}
        y1={laneTop}
        y2={laneTop}
        stroke="currentColor"
        className="text-border"
        strokeWidth={0.7}
        vectorEffect="non-scaling-stroke"
      />
      {Array.from({ length: rows }, (_, index) => (
        <line
          key={index}
          x1={padL}
          x2={x2}
          y1={laneTop + ((index + 0.5) / rows) * laneH}
          y2={laneTop + ((index + 0.5) / rows) * laneH}
          stroke="currentColor"
          className="text-border"
          strokeWidth={0.5}
          strokeOpacity={0.55}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

type LaneScopeHandlers = {
  begin: (clientX: number, clientY: number) => void;
  move: (clientX: number, clientY: number) => void;
  /** @returns true if time scope committed (tap should not pin) */
  end: (clientX: number, clientY: number) => boolean;
  cancel: () => void;
};

export function EventLaneHtmlOverlay({
  lane,
  marks,
  viewW,
  chartH,
  laneTop,
  laneH,
  compact,
  labelGutter,
  selectedId,
  onSelect,
  onHover,
  scopeHandlers = null,
}: {
  lane: TrendEventLane;
  marks: PositionedEventMark[];
  viewW: number;
  chartH: number;
  laneTop: number;
  laneH: number;
  compact?: boolean;
  labelGutter?: boolean;
  selectedId: string | null;
  onSelect: (mark: TrendEventMark) => void;
  onHover: (mark: TrendEventMark | null) => void;
  /** 설정 시 점 위 가로 드래그도 시간 스코프 (탭=핀) */
  scopeHandlers?: LaneScopeHandlers | null;
}) {
  const rowCount = Math.max(1, lane.rowLabels.length);
  const selectedRow =
    marks.find((row) => row.mark.id === selectedId)?.mark.row ?? null;
  const pctY = (yView: number) =>
    `${chartH > 0 ? (yView / chartH) * 100 : 0}%`;

  const armRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    mark: TrendEventMark;
  } | null>(null);
  const draggedRef = useRef(false);

  const clearArm = () => {
    armRef.current = null;
    draggedRef.current = false;
  };

  const onMarkPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    mark: TrendEventMark,
  ) => {
    event.stopPropagation();
    if (!isPrimaryPress(event)) return;
    armRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      mark,
    };
    draggedRef.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    scopeHandlers?.begin(event.clientX, event.clientY);
  };

  const onMarkPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const arm = armRef.current;
    if (!arm || arm.pointerId !== event.pointerId) return;
    const dist = Math.hypot(event.clientX - arm.x, event.clientY - arm.y);
    if (dist >= X_SCOPE_DRAG_PX) draggedRef.current = true;
    scopeHandlers?.move(event.clientX, event.clientY);
  };

  const onMarkPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const arm = armRef.current;
    if (!arm || arm.pointerId !== event.pointerId) {
      clearArm();
      return;
    }
    const committed = scopeHandlers?.end(event.clientX, event.clientY) ?? false;
    const wasDrag = draggedRef.current || committed;
    const mark = arm.mark;
    clearArm();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }
    if (wasDrag) return;
    onSelect(mark);
  };

  const onMarkPointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (armRef.current?.pointerId === event.pointerId) {
      scopeHandlers?.cancel();
      clearArm();
    }
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[3]"
      data-tour-id="chart-command-hit"
    >
      {lane.rowLabels.map((name, index) => (
        <div
          key={name}
          className={cn(
            "pointer-events-none absolute -translate-y-1/2 rounded-sm bg-background/85 text-right leading-none",
            farmChartUi.fsAxis,
            labelGutter ? "right-1" : "right-0.5",
            selectedRow === index
              ? dashboardChroma.chromeActiveText
              : dashboardChroma.chromeIdleText,
          )}
          style={{ top: pctY(laneTop + ((index + 0.5) / rowCount) * laneH) }}
          aria-hidden
        >
          {name}
        </div>
      ))}
      {marks.length === 0 ? (
        <p
          className={cn(
            "pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center",
            farmChartUi.fsMeta,
            dashboardChroma.chromeIdleText,
          )}
          style={{ top: pctY(laneTop + laneH / 2) }}
        >
          {lane.emptyLabel}
        </p>
      ) : null}
      {marks.map(({ mark, xView, yView }) => {
        const isSelected = selectedId === mark.id;
        return (
          <button
            key={mark.id}
            type="button"
            className={cn(
              "pointer-events-auto absolute flex items-center justify-center -translate-x-1/2 -translate-y-1/2",
              compact ? "size-9" : "size-7",
              dashboardAffordance.hitSurface,
              motionClass.microHover,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground",
              isSelected && "z-[1]",
            )}
            style={{
              left: `${viewW > 0 ? (xView / viewW) * 100 : 0}%`,
              top: pctY(yView),
            }}
            aria-label={mark.ariaLabel}
            aria-pressed={isSelected}
            onPointerDown={(event) => onMarkPointerDown(event, mark)}
            onPointerMove={onMarkPointerMove}
            onPointerUp={onMarkPointerUp}
            onPointerCancel={onMarkPointerCancel}
            onClick={(event) => {
              event.stopPropagation();
              // 포인터 탭은 pointerUp에서 핀. 키보드(Enter/Space)만 click 경로.
              if (event.detail !== 0) return;
              onSelect(mark);
            }}
            onMouseEnter={() => onHover(mark)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(mark)}
            onBlur={() => onHover(null)}
          >
            <span className={markDotClass(mark, isSelected)} />
          </button>
        );
      })}
    </div>
  );
}
