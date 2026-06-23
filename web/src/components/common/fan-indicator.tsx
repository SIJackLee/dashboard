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
  /** 컨트롤러 페이지 등 큰 글씨 */
  large?: boolean;
};

export function FanIndicator({
  kind,
  value = null,
  compact,
  large,
}: FanIndicatorProps) {
  const conf = fanMap[kind];
  const Icon = conf.icon;
  const hasValue = value !== null && value !== undefined;
  const pct = hasValue ? value : 0;
  const display = hasValue ? `${value.toFixed(1)}%` : null;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1",
          large ? "text-xl leading-none" : "text-xs"
        )}
      >
        <Icon className={cn(large ? "size-6" : "size-3.5", conf.className)} />
        {display != null ? (
          <span className="font-medium">{display}</span>
        ) : null}
      </span>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-background px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xl text-muted-foreground">
          <Icon className={cn("size-6", conf.className)} />
          {conf.label}
        </span>
        {display != null ? (
          <span className="text-2xl font-semibold tabular-nums">{display}</span>
        ) : null}
      </div>
      {hasValue ? (
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full bg-current", conf.className)}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
