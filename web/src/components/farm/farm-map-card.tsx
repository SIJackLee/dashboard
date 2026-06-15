"use client";

import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { Warehouse, Building2, GripVertical } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { EnvChip } from "@/components/common/env-chip";
import { StatusBadge } from "@/components/common/status-badge";
import { getStallTypeName, normalizeStallTyCode } from "@/lib/data/stall-type";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const fmt = (v: number | null, digits = 1) =>
  v === null ? "--" : v.toFixed(digits);

function displayCardTitle(snapshot: BarnMapSnapshot): string {
  const ty = snapshot.meta.stallNo
    ? normalizeStallTyCode(snapshot.meta.stallNo)
    : null;
  if (ty && ty !== "UNK") {
    const fromCode = getStallTypeName(ty);
    if (fromCode !== ty) return fromCode;
  }
  const legacy = snapshot.meta.name.trim();
  const stripped = legacy.replace(/^SP\d+\s*/i, "").trim();
  return stripped || legacy || "축사";
}

type Props = {
  snapshot: BarnMapSnapshot;
  className?: string;
  layout?: "grid" | "stack";
  compact?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  onGripPointerDown?: (id: string, e: React.PointerEvent) => void;
};

export function FarmMapCard({
  snapshot,
  className,
  layout = "grid",
  compact = false,
  draggable,
  isDragging,
  onGripPointerDown,
}: Props) {
  const { navigate, isPending } = useAppNavigate();
  const { meta } = snapshot;
  const Icon = meta.type === "office" ? Building2 : Warehouse;
  const catalogEntry = parseBarnCatalogKey(meta.id);
  const controllerHref = catalogEntry
    ? buildControllerHref({
        farmKey: catalogEntry.farmKey,
        sp: catalogEntry.stallTyCode,
      })
    : null;
  const title = displayCardTitle(snapshot);

  const handleNavigate = () => {
    if (isDragging || !controllerHref || isPending) return;
    navigate(controllerHref, { message: "컨트롤러 페이지로 이동 중…" });
  };

  return (
    <div
      className={cn(
        "flex h-auto min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-background shadow-sm transition-shadow",
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
      <div className="flex min-h-0 items-center gap-2 border-b bg-muted/30 px-2 py-1.5">
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
            className="pointer-events-auto shrink-0 cursor-grab touch-none select-none rounded border border-muted-foreground/25 bg-muted/50 p-1.5 text-muted-foreground hover:border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-700 active:cursor-grabbing"
            aria-label="축사 위치 이동"
          >
            <GripVertical className="size-5 pointer-events-none" />
          </div>
        )}
        <button
          type="button"
          onClick={handleNavigate}
          disabled={!controllerHref}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 text-left",
            controllerHref && "cursor-pointer"
          )}
        >
          <Icon className="size-5 shrink-0 text-emerald-600" />
          <span
            className={cn(
              "truncate font-semibold",
              compact ? dashboardUi.mapCardMeta : dashboardUi.mapCardTitle
            )}
          >
            {title}
          </span>
        </button>
        <StatusBadge tone={snapshot.status} compact large />
      </div>

      <button
        type="button"
        onClick={handleNavigate}
        disabled={!controllerHref}
        className={cn(
          "flex min-h-0 flex-col gap-1.5 px-2.5 py-2 text-left",
          controllerHref && "cursor-pointer hover:bg-muted/20"
        )}
      >
        <div className="grid grid-cols-2 gap-1.5">
          <EnvChip kind="temp" value={fmt(snapshot.tempC)} />
          <EnvChip kind="humidity" value={fmt(snapshot.humidityPct)} />
        </div>
      </button>
    </div>
  );
}
