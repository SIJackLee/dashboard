"use client";

import type { ControllerReading } from "@/lib/data/iot";
import { farmKeyId } from "@/lib/data/farm-key";
import { formatStallTypeLabel, normalizeStallTyCode } from "@/lib/data/stall-type";
import { StatusBadge } from "@/components/common/status-badge";
import { cn } from "@/lib/utils";

type Props = {
  readings: ControllerReading[];
  selectedSpCode?: string;
  onSelectSp: (spCode: string) => void;
};

export function OpsMobileSpOverview({
  readings,
  selectedSpCode,
  onSelectSp,
}: Props) {
  const groups = new Map<string, ControllerReading[]>();
  for (const r of readings) {
    const sp = normalizeStallTyCode(r.stallTyCode);
    if (!sp || sp === "UNK") continue;
    const list = groups.get(sp) ?? [];
    list.push(r);
    groups.set(sp, list);
  }

  const items = [...groups.entries()].sort((a, b) =>
    formatStallTypeLabel(a[0]).localeCompare(formatStallTypeLabel(b[0]), "ko")
  );

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed bg-muted/20 p-4">
        <p className="text-center text-sm text-muted-foreground">
          축사 데이터가 없습니다. LIVE 수신 후 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-muted/10 p-2">
      <div className="grid grid-cols-2 gap-1.5 min-[400px]:grid-cols-3 min-[400px]:gap-2">
        {items.map(([sp, list]) => {
          const worst =
            list.find((r) => r.status === "offline") ??
            list.find((r) => r.status === "caution") ??
            list[0];
          const active = normalizeStallTyCode(selectedSpCode) === sp;
          const label = formatStallTypeLabel(sp);
          return (
            <button
              key={sp}
              type="button"
              onClick={() => onSelectSp(sp)}
              className={cn(
                "flex max-h-10 min-h-9 flex-col justify-center rounded-lg border bg-background p-1.5 text-left transition-colors",
                active
                  ? "border-emerald-500 bg-emerald-50"
                  : "hover:bg-muted/30"
              )}
            >
              <div className="flex min-w-0 items-center justify-between gap-1">
                <span
                  className="min-w-0 flex-1 truncate text-[10px] font-semibold leading-none"
                  title={label}
                >
                  {label}
                </span>
                <StatusBadge tone={worst?.status ?? "offline"} compact />
              </div>
              <p className="mt-0.5 text-[9px] leading-none text-muted-foreground">
                {list.length}대
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function pickReadingForSp(
  readings: ControllerReading[],
  spCode: string,
  farmId?: string
): ControllerReading | undefined {
  const sp = normalizeStallTyCode(spCode);
  const scope = readings.filter((r) => {
    if (farmId && farmKeyId(r.farmKey) !== farmId) return false;
    return normalizeStallTyCode(r.stallTyCode) === sp;
  });
  return (
    scope.find((r) => r.status === "offline") ??
    scope.find((r) => r.status === "caution") ??
    scope[0]
  );
}
