import { Thermometer, Droplets } from "lucide-react";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type EnvKind = "temp" | "humidity";

const kindMap: Record<
  EnvKind,
  { label: string; unit: string; icon: typeof Thermometer; className: string }
> = {
  temp: {
    label: "온도",
    unit: "℃",
    icon: Thermometer,
    className: "text-orange-500",
  },
  humidity: {
    label: "습도",
    unit: "%",
    icon: Droplets,
    className: "text-sky-500",
  },
};

type EnvChipProps = {
  kind: EnvKind;
  value?: string | null;
  tone?: string;
  /** 그리드 카드 — 라벨 없이 아이콘+값만 */
  valueOnly?: boolean;
  compact?: boolean;
};

export function EnvChip({
  kind,
  value,
  tone,
  valueOnly = false,
  compact = false,
}: EnvChipProps) {
  const conf = kindMap[kind];
  const Icon = conf.icon;
  const hasValue = value != null && value !== "" && value !== "--";

  if (valueOnly) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center justify-center gap-1 overflow-hidden rounded-md border bg-background",
          compact
            ? "min-h-[3rem] gap-1 px-1.5 py-1 sm:min-h-[3.25rem]"
            : "px-2 py-1.5",
        )}
        aria-label={
          hasValue ? `${conf.label} ${value}${conf.unit}` : conf.label
        }
      >
        <Icon
          className={cn(
            compact ? dashboardUi.gridCellIconCompact : dashboardUi.gridCellIconDefault,
            conf.className,
          )}
          aria-hidden
        />
        <span
          className={cn(
            "min-w-0 truncate whitespace-nowrap text-foreground",
            compact ? dashboardUi.gridCellValueCompact : dashboardUi.gridCellValueDefault,
          )}
        >
          {hasValue ? (
            <>
              {value}
              <span
                className={cn(
                  "ml-0.5 font-normal text-muted-foreground",
                  compact ? dashboardUi.gridCellMetaCompact : dashboardUi.tableMeta,
                )}
              >
                {conf.unit}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </span>
        {tone ? (
          <span className="sr-only">{tone}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
      aria-label={hasValue ? `${conf.label} ${value}${conf.unit}` : conf.label}
    >
      <Icon className={cn(dashboardUi.iconSm, conf.className)} aria-hidden />
      {hasValue ? (
        <p className={cn(dashboardUi.value, "leading-none text-foreground")}>
          {value}
          <span className={cn("ml-1", dashboardUi.tableMeta)}>{conf.unit}</span>
        </p>
      ) : (
        <span className={cn(dashboardUi.value, "leading-none text-muted-foreground")}>
          —
        </span>
      )}
      {tone ? (
        <span className={cn("ml-auto shrink-0", dashboardUi.tableMeta)}>{tone}</span>
      ) : null}
    </div>
  );
}
