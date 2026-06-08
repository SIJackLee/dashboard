import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value?: string;
  unit?: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: "default" | "emerald" | "amber" | "red" | "sky";
};

const accentMap: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-foreground",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  sky: "text-sky-600",
};

export function StatCard({
  label,
  value = "--",
  unit,
  sub,
  icon: Icon,
  accent = "default",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className={cn("text-2xl font-bold", accentMap[accent])}>
            {value}
            {unit && <span className="ml-1 text-base font-medium">{unit}</span>}
          </p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <span className={cn("rounded-md bg-muted p-2", accentMap[accent])}>
            <Icon className="size-5" />
          </span>
        )}
      </CardContent>
    </Card>
  );
}
