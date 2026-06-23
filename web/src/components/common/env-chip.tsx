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
};

export function EnvChip({ kind, value, tone }: EnvChipProps) {
  const conf = kindMap[kind];
  const Icon = conf.icon;
  const hasValue = value != null && value !== "" && value !== "--";
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background px-4 py-3">
      <Icon className={cn(dashboardUi.iconSm, conf.className)} />
      <div className="min-w-0 leading-tight">
        <p className={dashboardUi.tableMeta}>{conf.label}</p>
        {hasValue ? (
          <p className={cn(dashboardUi.value, "text-foreground")}>
            {value}
            <span className={cn("ml-1", dashboardUi.tableMeta)}>{conf.unit}</span>
          </p>
        ) : null}
      </div>
      {tone && (
        <span className={cn("ml-auto shrink-0", dashboardUi.tableMeta)}>{tone}</span>
      )}
    </div>
  );
}
