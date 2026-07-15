"use client";

import { Warehouse, Building2, GripVertical, Check } from "lucide-react";
import type { BarnMapSnapshot } from "@/lib/data/iot";
import { parseBarnCatalogKey } from "@/lib/data/barn-catalog";
import { EnvChip } from "@/components/common/env-chip";
import type { StatusTone } from "@/components/common/status-badge";
import { getStallTypeName, formatStallTypeLabelCompact } from "@/lib/data/stall-type";
import { formatSensorNumberForDisplay } from "@/lib/data/reading-display";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
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
  const entry = parseBarnCatalogKey(snapshot.meta.id);
  const stallNo = snapshot.meta.stallNo?.trim() ?? "";
  if (entry && entry.stallTyCode !== "UNK") {
    const tyName = compact
      ? formatStallTypeLabelCompact(entry.stallTyCode)
      : getStallTypeName(entry.stallTyCode);
    if (tyName && tyName !== entry.stallTyCode) {
      return stallNo ? `${tyName} ${stallNo}` : tyName;
    }
  }
  const legacy = snapshot.meta.name.trim();
  const stripped = legacy.replace(/^SP\d+\s*/i, "").trim();
  const base = stripped || legacy || "축사";
  return stallNo ? `${base} ${stallNo}` : base;
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
  /** 병합 카드 — 온·습도 요약 아래에 함께 표시할 히트맵 슬롯 */
  graphContent?: React.ReactNode;
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
  graphContent,
}: Props) {
  const { meta } = snapshot;
  const Icon = meta.type === "office" ? Building2 : Warehouse;
  const title = displayCardTitle(snapshot, compact);

  // 레거시 그래프 드릴(카드 클릭 → sp 라우팅) 제거 — 클릭은 일괄모드 선택에만 사용.
  const handleSelect = () => {
    if (isDragging) return;
    onSelect?.();
  };

  return (
    <div
      aria-label={`${title} ${STATUS_LABEL[snapshot.status]}`}
      data-tour-id="barn-card"
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-background transition-shadow",
        layout === "stack" || !compact ? "h-auto" : "h-full",
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
      <div
        className={cn(
          "flex min-h-0 shrink-0 items-center gap-1 border-b bg-muted/30",
          compact ? "gap-1 px-1.5 py-1" : "gap-1.5 px-2 py-1.5 lg:gap-2"
        )}
      >
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
            className={cn(
              "pointer-events-auto hidden shrink-0 cursor-grab touch-none select-none rounded border border-muted-foreground/25 bg-muted/50 text-muted-foreground hover:border-emerald-500/50 hover:bg-emerald-50 hover:text-emerald-700 active:cursor-grabbing lg:block",
              compact ? "p-1" : "p-1.5",
            )}
            aria-label="축사 위치 이동"
            data-tour-id="barn-drag"
          >
            <GripVertical
              className={cn(
                "pointer-events-none",
                compact ? dashboardUi.gridCellIconCompact : dashboardUi.gridCellIconDefault,
              )}
              aria-hidden
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleSelect}
          disabled={!onSelect}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-1.5 text-left",
            onSelect && "cursor-pointer"
          )}
        >
          <Icon
            className={cn(
              "text-emerald-600",
              compact ? dashboardUi.gridCellIconCompact : dashboardUi.gridCellIconDefault,
            )}
          />
          <span
            className={cn(
              "min-w-0 flex-1",
              compact
                ? cn("line-clamp-2", dashboardUi.gridCellValueCompact)
                : cn("truncate whitespace-nowrap", dashboardUi.gridCellValueDefault),
            )}
            title={title}
          >
            {title}
          </span>
        </button>
      </div>

      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          compact ? "gap-1 px-1.5 py-1" : "gap-1 px-2 py-1.5"
        )}
      >
        <button
          type="button"
          onClick={handleSelect}
          disabled={!onSelect}
          className={cn(
            "grid min-h-0 grid-cols-2 rounded text-left",
            compact ? "gap-1" : "gap-1 [&>div]:px-2 [&>div]:py-1.5 lg:[&>div]:px-4 lg:[&>div]:py-3",
            onSelect && "cursor-pointer hover:bg-muted/20"
          )}
        >
          <EnvChip
            kind="temp"
            value={formatSensorNumberForDisplay(snapshot.status, snapshot.tempC)}
            valueOnly={compact}
            compact={compact}
          />
          <EnvChip
            kind="humidity"
            value={formatSensorNumberForDisplay(
              snapshot.status,
              snapshot.humidityPct
            )}
            valueOnly={compact}
            compact={compact}
          />
        </button>
        {graphContent ? <div className="min-h-0">{graphContent}</div> : null}
      </div>
    </div>
  );
}
