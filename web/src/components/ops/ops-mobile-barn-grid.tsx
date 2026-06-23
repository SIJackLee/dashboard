"use client";

import { Droplets, Thermometer, Warehouse } from "lucide-react";
import type { BarnMapSnapshot, ControllerStatus } from "@/lib/data/iot";
import { getStallTypeName, normalizeStallTyCode } from "@/lib/data/stall-type";
import { isBarnSelected } from "@/lib/monitoring/barn-grid-select";
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

function statusShortLabel(tone: ControllerStatus): string {
  switch (tone) {
    case "normal":
      return "정상";
    case "caution":
      return "주의";
    default:
      return "끊김";
  }
}

function OpsMobileBarnTile({
  snapshot,
  selected,
  onSelect,
}: {
  snapshot: BarnMapSnapshot;
  selected: boolean;
  onSelect: () => void;
}) {
  const title = displayCardTitle(snapshot);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex min-w-0 flex-col gap-1.5 rounded-lg border bg-background p-2 text-left shadow-sm transition-colors",
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500/40"
          : "border-border hover:bg-muted/20"
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <Warehouse className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold leading-tight line-clamp-2">
          {title}
        </span>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-1">
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-[10px] leading-none",
            snapshot.status === "normal" && "text-emerald-700",
            snapshot.status === "caution" && "text-amber-700",
            snapshot.status === "offline" && "text-muted-foreground"
          )}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-current" />
          {statusShortLabel(snapshot.status)}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <Thermometer className="size-3 shrink-0 text-orange-500" aria-hidden />
            {fmt(snapshot.tempC)}℃
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Droplets className="size-3 shrink-0 text-sky-500" aria-hidden />
            {fmt(snapshot.humidityPct)}%
          </span>
        </span>
      </div>
    </button>
  );
}

type Props = {
  barns: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  selectedFarmId?: string;
  selectedSpCode?: string;
  onSelectBarn: (snapshot: BarnMapSnapshot) => void;
};

export function OpsMobileBarnGrid({
  barns,
  selectedFarmId,
  selectedSpCode,
  onSelectBarn,
}: Props) {
  if (barns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed bg-muted/20 p-4">
        <p className={cn("text-center text-sm text-muted-foreground", dashboardUi.body)}>
          축사 그리드 데이터가 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-muted/10 p-2">
      <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">
        {barns.map((snapshot) => {
          const selected =
            selectedFarmId && selectedSpCode
              ? isBarnSelected(snapshot, selectedSpCode, selectedFarmId)
              : false;
          return (
            <OpsMobileBarnTile
              key={snapshot.meta.id}
              snapshot={snapshot}
              selected={selected}
              onSelect={() => onSelectBarn(snapshot)}
            />
          );
        })}
      </div>
    </div>
  );
}
