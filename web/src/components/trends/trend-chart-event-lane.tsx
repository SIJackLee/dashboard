"use client";

import { farmChartUi } from "@/lib/ui/farm-chart-ui-scale";
import {
  dashboardAffordance,
  dashboardChroma,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { isPrimaryPress } from "@/lib/ui/pointer-press";
import { cn } from "@/lib/utils";
import type { TrendEventLane, TrendEventMark } from "@/lib/data/trend-chart-types";

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
        ? "bg-[color-mix(in_oklch,var(--channel-info)_80%,transparent)] border-background"
        : mark.infoStrength === 2
          ? "bg-[color-mix(in_oklch,var(--channel-info)_55%,transparent)] border-background"
          : "bg-[color-mix(in_oklch,var(--channel-info)_35%,transparent)] border-background";
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
}) {
  const rowCount = Math.max(1, lane.rowLabels.length);
  const selectedRow =
    marks.find((row) => row.mark.id === selectedId)?.mark.row ?? null;
  const pctY = (yView: number) =>
    `${chartH > 0 ? (yView / chartH) * 100 : 0}%`;

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
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!isPrimaryPress(event)) return;
              onSelect(mark);
            }}
            onPointerUp={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
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
