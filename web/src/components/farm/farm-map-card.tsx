"use client";

import { useRouter } from "next/navigation";
import { Warehouse, Building2, GripVertical } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { StatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils";

const fmt = (v: number | null, digits = 1) =>
  v === null ? "--" : v.toFixed(digits);

type Props = {
  snapshot: BarnMapSnapshot;
  className?: string;
  layout?: "grid" | "stack";
  draggable?: boolean;
  isDragging?: boolean;
  onGripPointerDown?: (id: string, e: React.PointerEvent) => void;
};

export function FarmMapCard({
  snapshot,
  className,
  layout = "grid",
  draggable,
  isDragging,
  onGripPointerDown,
}: Props) {
  const router = useRouter();
  const { meta } = snapshot;
  const Icon = meta.type === "office" ? Building2 : Warehouse;
  const href = `/controllers?farm=${meta.farmUid}&module=${meta.moduleUid}`;

  const handleNavigate = () => {
    if (!isDragging) router.push(href);
  };

  return (
    <div
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-background shadow-sm transition-shadow",
        isDragging && "opacity-50 ring-2 ring-emerald-400",
        layout === "grid" && "hover:shadow-md",
        className
      )}
      style={
        layout === "grid"
          ? { gridColumn: meta.grid.col, gridRow: meta.grid.row }
          : undefined
      }
    >
      <div className="flex min-h-0 items-center gap-1 border-b bg-muted/30 px-1.5 py-1">
        {draggable && (
          <div
            role="button"
            tabIndex={0}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              onGripPointerDown?.(meta.id, e);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") e.preventDefault();
            }}
            className="pointer-events-auto shrink-0 cursor-grab touch-none select-none rounded border border-muted-foreground/25 bg-muted/50 p-1 text-muted-foreground hover:border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-700 active:cursor-grabbing"
            aria-label="축사 위치 이동"
          >
            <GripVertical className="size-4 pointer-events-none" />
          </div>
        )}
        <button
          type="button"
          onClick={handleNavigate}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          <Icon className="size-3 shrink-0 text-emerald-600" />
          <span className="truncate text-xs font-medium">
            {meta.name}
            <span className="ml-1 font-normal text-muted-foreground">
              ({meta.stallNo})
            </span>
          </span>
        </button>
        <StatusBadge tone={snapshot.status} compact />
      </div>

      <button
        type="button"
        onClick={handleNavigate}
        className="flex min-h-0 flex-1 flex-col p-2 text-left hover:bg-muted/20"
      >
        <dl className="grid min-h-0 grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px] leading-tight">
          <dt className="text-muted-foreground">온도</dt>
          <dd className="truncate text-right font-medium">{fmt(snapshot.tempC)}℃</dd>
          <dt className="text-muted-foreground">습도</dt>
          <dd className="truncate text-right font-medium">
            {fmt(snapshot.humidityPct)}%
          </dd>
          <dt className="text-muted-foreground">송풍</dt>
          <dd className="truncate text-right font-medium">
            {snapshot.fanSupply === null ? "--" : `${Math.round(snapshot.fanSupply)}%`}
          </dd>
          <dt className="text-muted-foreground">배/입</dt>
          <dd className="truncate text-right font-medium">
            {snapshot.fanExhaust === null && snapshot.fanIntake === null
              ? "--"
              : `${snapshot.fanExhaust !== null ? Math.round(snapshot.fanExhaust) : "--"}/${snapshot.fanIntake !== null ? Math.round(snapshot.fanIntake) : "--"}%`}
          </dd>
        </dl>
      </button>
    </div>
  );
}
