"use client";

import { useMemo, useState } from "react";
import type { CommandTimelineItem } from "@/lib/admin/health/types";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthCommandEventGraphProps = {
  items: CommandTimelineItem[];
  fetchedAt: string;
};

type GraphFilter = "active" | "all";

const LANE_LIMIT = 12;

function minAgo(iso: string, nowMs: number): number {
  return Math.max(0, (nowMs - new Date(iso).getTime()) / 60_000);
}

function barColor(status: CommandTimelineItem["timelineStatus"]): string {
  switch (status) {
    case "ok":
      return "#10b981";
    case "warn":
      return "#f59e0b";
    case "critical":
      return "#ef4444";
    default:
      return "#94a3b8";
  }
}

export function HealthCommandEventGraph({
  items,
  fetchedAt,
}: HealthCommandEventGraphProps) {
  const [filter, setFilter] = useState<GraphFilter>("active");
  const nowMs = new Date(fetchedAt).getTime();

  const visible = useMemo(() => {
    const filtered =
      filter === "active"
        ? items.filter(
            (i) =>
              i.timelineStatus !== "ok" || i.checkpoint
          )
        : items;
    return filtered.slice(0, LANE_LIMIT);
  }, [filter, items]);

  const maxMin = useMemo(() => {
    if (visible.length === 0) return 180;
    let oldest = 0;
    for (const ev of visible) {
      oldest = Math.max(oldest, minAgo(ev.createdAt, nowMs));
      if (ev.sentAt) oldest = Math.max(oldest, minAgo(ev.sentAt, nowMs));
      if (ev.appliedAt) oldest = Math.max(oldest, minAgo(ev.appliedAt, nowMs));
    }
    return Math.min(1440, Math.max(60, Math.ceil(oldest * 1.1)));
  }, [visible, nowMs]);

  if (items.length === 0) {
    return (
      <p className={dashboardTypography.meta}>
        최근 24h 명령 이력 없음
      </p>
    );
  }

  const marginLeft = 112;
  const marginTop = 24;
  const laneH = 36;
  const chartW = 520;
  const height = marginTop + visible.length * laneH + 28;

  function xFor(minAgoVal: number): number {
    return marginLeft + chartW * (1 - minAgoVal / maxMin);
  }

  const tickMarks = [maxMin / 4, maxMin / 2, (maxMin * 3) / 4].map((t) =>
    Math.round(t)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={dashboardTypography.sectionTitle}>
          명령 생애주기 · 이벤트 그래프
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              filter === "active"
                ? "border-primary bg-primary/10"
                : "bg-card hover:bg-muted/40"
            )}
            onClick={() => setFilter("active")}
          >
            미해결·체크포인트
          </button>
          <button
            type="button"
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm",
              filter === "all"
                ? "border-primary bg-primary/10"
                : "bg-card hover:bg-muted/40"
            )}
            onClick={() => setFilter("all")}
          >
            전체 24h
          </button>
        </div>
      </div>

      <p className={dashboardTypography.meta}>
        X축: 경과 시간 (분, now=우측) · Y축: 명령 lane · Source: ctrl_thermo_command
        · 최근 24h
        {visible.length < items.length && filter === "all"
          ? ` · 상위 ${LANE_LIMIT}건`
          : ""}
      </p>

      {visible.length === 0 ? (
        <p className={cn(dashboardTypography.body, "text-emerald-700")}>
          미해결·체크포인트 대상 없음
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${marginLeft + chartW + 16} ${height}`}
            className="h-auto min-w-[36rem] w-full max-w-3xl"
            role="img"
            aria-label="Command lifecycle event graph"
          >
            <text
              x={marginLeft}
              y={12}
              className="fill-muted-foreground text-[9px]"
            >
              −{maxMin}m
            </text>
            <text
              x={marginLeft + chartW}
              y={12}
              className="fill-muted-foreground text-[9px]"
              textAnchor="end"
            >
              now
            </text>
            <line
              x1={marginLeft}
              y1={marginTop - 6}
              x2={marginLeft + chartW}
              y2={marginTop - 6}
              className="stroke-border"
              strokeWidth={1}
            />

            {tickMarks.map((t) => (
              <g key={t}>
                <line
                  x1={xFor(t)}
                  y1={marginTop}
                  x2={xFor(t)}
                  y2={marginTop + visible.length * laneH}
                  className="stroke-border/60"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <text
                  x={xFor(t)}
                  y={height - 4}
                  className="fill-muted-foreground/70 text-[8px]"
                  textAnchor="middle"
                >
                  −{t}m
                </text>
              </g>
            ))}

            {visible.map((ev, li) => {
              const y = marginTop + li * laneH + laneH / 2;
              const pendingX = xFor(minAgo(ev.createdAt, nowMs));
              const sentX = ev.sentAt ? xFor(minAgo(ev.sentAt, nowMs)) : null;
              const appliedX = ev.appliedAt
                ? xFor(minAgo(ev.appliedAt, nowMs))
                : null;
              const color = barColor(ev.timelineStatus);
              const endX = appliedX ?? sentX ?? pendingX;
              const nowX = marginLeft + chartW - 8;

              return (
                <g key={ev.commandId}>
                  <text
                    x={0}
                    y={y + 4}
                    className="fill-muted-foreground text-[10px]"
                  >
                    {ev.lane}
                  </text>
                  <line
                    x1={marginLeft}
                    y1={y + 10}
                    x2={marginLeft + chartW}
                    y2={y + 10}
                    className="stroke-border/50"
                    strokeWidth={1}
                  />
                  {sentX != null ? (
                    <line
                      x1={pendingX}
                      y1={y}
                      x2={sentX}
                      y2={y}
                      stroke={color}
                      strokeWidth={3}
                      opacity={0.45}
                    />
                  ) : null}
                  {sentX != null && appliedX != null ? (
                    <line
                      x1={sentX}
                      y1={y}
                      x2={appliedX}
                      y2={y}
                      stroke={color}
                      strokeWidth={3}
                    />
                  ) : null}
                  {sentX != null && appliedX == null && ev.status === "sent" ? (
                    <line
                      x1={sentX}
                      y1={y}
                      x2={nowX}
                      y2={y}
                      stroke={color}
                      strokeWidth={3}
                      strokeDasharray="4 3"
                    />
                  ) : null}
                  {sentX == null && ev.status === "pending" ? (
                    <line
                      x1={pendingX}
                      y1={y}
                      x2={nowX}
                      y2={y}
                      stroke={color}
                      strokeWidth={3}
                      strokeDasharray="4 3"
                    />
                  ) : null}

                  <circle
                    cx={pendingX}
                    cy={y}
                    r={5}
                    className="fill-card stroke-sky-500"
                    strokeWidth={2}
                  />
                  {sentX != null ? (
                    <rect
                      x={sentX - 4}
                      y={y - 4}
                      width={8}
                      height={8}
                      className="fill-card"
                      stroke={color}
                      strokeWidth={2}
                    />
                  ) : null}
                  {appliedX != null ? (
                    <circle
                      cx={appliedX}
                      cy={y}
                      r={5}
                      fill={color}
                      stroke={color}
                      strokeWidth={2}
                    />
                  ) : null}
                  {ev.status === "failed" ? (
                    <path
                      d={`M ${endX - 4} ${y - 4} L ${endX + 4} ${y + 4} M ${endX + 4} ${y - 4} L ${endX - 4} ${y + 4}`}
                      stroke="#ef4444"
                      strokeWidth={2}
                    />
                  ) : null}
                  {ev.checkpoint ? (
                    <polygon
                      points={`${sentX ?? pendingX},${y - 10} ${(sentX ?? pendingX) + 7},${y - 5} ${(sentX ?? pendingX) + 7},${y + 3} ${sentX ?? pendingX},${y + 8} ${(sentX ?? pendingX) - 7},${y + 3} ${(sentX ?? pendingX) - 7},${y - 5}`}
                      className="fill-muted stroke-primary"
                      strokeWidth={1}
                    />
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span>○ pending</span>
        <span>□ sent</span>
        <span className="text-emerald-600">● applied</span>
        <span className="text-red-600">× failed</span>
        <span className="text-primary">◇ checkpoint</span>
      </div>
    </div>
  );
}
