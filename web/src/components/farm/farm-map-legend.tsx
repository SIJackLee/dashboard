import type { ControllerStatus } from "@/lib/data/iot";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const items: { status: ControllerStatus; label: string; className: string }[] = [
  { status: "normal", label: "정상", className: "bg-emerald-500" },
  { status: "caution", label: "주의", className: "bg-amber-500" },
  { status: "offline", label: "오프라인", className: "bg-muted-foreground" },
];

export function FarmMapLegend() {
  return (
    <div className="absolute right-3 top-3 rounded-lg border bg-background/95 px-4 py-3 shadow-sm backdrop-blur">
      <p className={cn("mb-2", dashboardUi.chartLabel, "text-muted-foreground")}>
        범례
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.status}
            className={cn("flex items-center gap-2", dashboardUi.chartLegend)}
          >
            <span className={cn("size-3 rounded-full", item.className)} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
