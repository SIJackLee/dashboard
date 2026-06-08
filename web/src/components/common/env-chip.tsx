import { Thermometer, Droplets } from "lucide-react";
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
  value?: string;
  tone?: string;
};

export function EnvChip({ kind, value = "--", tone }: EnvChipProps) {
  const conf = kindMap[kind];
  const Icon = conf.icon;
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
      <Icon className={cn("size-4", conf.className)} />
      <div className="leading-tight">
        <p className="text-xs text-muted-foreground">{conf.label}</p>
        <p className="text-sm font-semibold">
          {value}
          <span className="ml-0.5 text-xs font-normal">{conf.unit}</span>
        </p>
      </div>
      {tone && <span className="ml-auto text-xs text-muted-foreground">{tone}</span>}
    </div>
  );
}
