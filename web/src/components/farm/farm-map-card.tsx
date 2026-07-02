"use client";

import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { Warehouse, Building2, GripVertical, Check } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { buildControllerHref } from "@/lib/auth/farm-access";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { EnvChip } from "@/components/common/env-chip";
import type { StatusTone } from "@/components/common/status-badge";
import { getStallTypeName, normalizeStallTyCode, formatStallTypeLabelCompact } from "@/lib/data/stall-type";
import { formatSensorNumberForDisplay } from "@/lib/data/reading-display";
import { cn } from "@/lib/utils";

/** 상태별 링/글로우 — 뱃지 대신 카드 자체에 색상 임팩트. 경고는 글로우 강화, 오프라인은 디밍. */
const STATUS_ACCENT: Record<StatusTone, string> = {
  normal: "ring-1 ring-emerald-400/70",
  caution:
    "ring-2 ring-amber-400/80 shadow-[0_0_0_2px_rgba(245,158,11,0.16)]",
  warning:
    "ring-2 ring-red-500/90 shadow-[0_0_16px_2px_rgba(239,68,68,0.40)]",
  offline: "ring-1 ring-muted-foreground/30 opacity-70 saturate-50",
};

const STATUS_LABEL: Record<StatusTone, string> = {
  normal: "정상",
  caution: "주의",
  warning: "경고",
  offline: "오프라인",
};

function displayCardTitle(snapshot: BarnMapSnapshot, compact = false): string {
  const ty = snapshot.meta.stallNo
    ? normalizeStallTyCode(snapshot.meta.stallNo)
    : null;
  if (ty && ty !== "UNK") {
    const fromCode = compact
      ? formatStallTypeLabelCompact(ty)
      : getStallTypeName(ty);
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
  /** ops 모바일 그리드 — 페이지 이동 대신 콜백 */
  onSelect?: () => void;
  /** 일괄적용 모드 — 카드 선택 토글 UI */
  selectable?: boolean;
  selected?: boolean;
};

export function FarmMapCard({
  snapshot,
  className,
  layout = "grid",
  compact = false,
  draggable,
  isDragging,
  onGripPointerDown,
  onSelect,
  selectable = false,
  selected = false,
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
  const title = displayCardTitle(snapshot, compact);

  const handleNavigate = () => {
    if (isDragging) return;
    if (onSelect) {
      onSelect();
      return;
    }
    if (!controllerHref || isPending) return;
    navigate(controllerHref, { message: "컨트롤러 페이지로 이동 중…" });
  };

  return (
    <div
      aria-label={`${title} ${STATUS_LABEL[snapshot.status]}`}
      className={cn(
        "flex h-auto min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-background transition-shadow",
        STATUS_ACCENT[snapshot.status],
        isDragging && "!opacity-50 !ring-2 !ring-emerald-400",
        layout === "grid" && "hover:shadow-md",
        selectable && "cursor-pointer",
        selected && "!ring-2 !ring-primary !ring-offset-1",
        className
      )}
      style={
        layout === "grid"
          ? { gridColumn: meta.grid.col, gridRow: meta.grid.row }
          : undefined
      }
    >
      <div className="flex min-h-0 items-center gap-1.5 border-b bg-muted/30 px-2 py-1.5 lg:gap-2">
        {selectable ? (
          <span
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded border",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40 bg-background"
            )}
            aria-hidden
          >
            {selected ? <Check className="size-3.5" /> : null}
          </span>
        ) : null}
        {draggable ? (
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
            className="pointer-events-auto hidden shrink-0 cursor-grab touch-none select-none rounded border border-muted-foreground/25 bg-muted/50 p-1.5 text-muted-foreground hover:border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-700 active:cursor-grabbing lg:block"
            aria-label="축사 위치 이동"
          >
            <GripVertical className="pointer-events-none size-5" />
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleNavigate}
          disabled={!onSelect && !controllerHref}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 text-left",
            (onSelect || controllerHref) && "cursor-pointer"
          )}
        >
          <Icon className="size-4 shrink-0 text-emerald-600 lg:size-5" />
          <span
            className={cn(
              "min-w-0 flex-1 font-semibold leading-tight",
              compact
                ? "line-clamp-2 text-[10px] sm:text-xs"
                : "truncate text-sm lg:text-lg lg:truncate lg:whitespace-nowrap",
              !compact && "lg:text-xl"
            )}
            title={title}
          >
            {title}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={handleNavigate}
        disabled={!onSelect && !controllerHref}
        className={cn(
          "flex min-h-0 flex-col gap-1 px-2 py-1.5 text-left",
          (onSelect || controllerHref) && "cursor-pointer hover:bg-muted/20"
        )}
      >
        <div className="grid grid-cols-2 gap-1 [&>div]:px-2 [&>div]:py-1.5 lg:[&>div]:px-4 lg:[&>div]:py-3">
          <EnvChip
            kind="temp"
            value={formatSensorNumberForDisplay(snapshot.status, snapshot.tempC)}
          />
          <EnvChip
            kind="humidity"
            value={formatSensorNumberForDisplay(
              snapshot.status,
              snapshot.humidityPct
            )}
          />
        </div>
      </button>
    </div>
  );
}
