import { Fan, Wind, ArrowDownToLine } from "lucide-react";
import { cn } from "@/lib/utils";

export type FanKind = "supply" | "exhaust" | "intake";

// EC01=송풍팬(supply), EC02=배기팬(exhaust), EC03=입기팬(intake) / 단위 %
const fanMap: Record<
  FanKind,
  { label: string; icon: typeof Fan; className: string }
> = {
  supply: { label: "송풍팬", icon: Fan, className: "text-emerald-500" },
  exhaust: { label: "배기팬", icon: Wind, className: "text-sky-500" },
  intake: { label: "입기팬", icon: ArrowDownToLine, className: "text-violet-500" },
};

type FanIndicatorProps = {
  kind: FanKind;
  /** 0~100 (%) — 데이터 매칭 추후 */
  value?: number | null;
  compact?: boolean;
};

export function FanIndicator({ kind, value = null, compact }: FanIndicatorProps) {
  const conf = fanMap[kind];
  const Icon = conf.icon;
  const pct = value ?? 0;
  const display = value === null ? "--" : `${value}%`;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1 text-xs">
        <Icon className={cn("size-3.5", conf.className)} />
        <span className="font-medium">{display}</span>
      </span>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Icon className={cn("size-3.5", conf.className)} />
          {conf.label}
        </span>
        <span className="font-semibold">{display}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full bg-current", conf.className)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
