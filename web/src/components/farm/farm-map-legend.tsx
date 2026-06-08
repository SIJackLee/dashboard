import type { ControllerStatus } from "@/lib/data/iot";
import { cn } from "@/lib/utils";

const items: { status: ControllerStatus; label: string; className: string }[] = [
  { status: "normal", label: "정상", className: "bg-emerald-500" },
  { status: "caution", label: "주의", className: "bg-amber-500" },
  { status: "offline", label: "오프라인", className: "bg-muted-foreground" },
];

export function FarmMapLegend() {
  return (
    <div className="absolute right-3 top-3 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur">
      <p className="mb-1.5 font-medium text-muted-foreground">범례</p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.status} className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full", item.className)} />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
