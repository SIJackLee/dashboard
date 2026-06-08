import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "normal" | "caution" | "warning" | "offline";

const toneMap: Record<StatusTone, { label: string; className: string }> = {
  normal: { label: "정상", className: "bg-emerald-50 text-emerald-700" },
  caution: { label: "주의", className: "bg-amber-50 text-amber-700" },
  warning: { label: "경고", className: "bg-red-50 text-red-700" },
  offline: { label: "오프라인", className: "bg-muted text-muted-foreground" },
};

type StatusBadgeProps = {
  tone: StatusTone;
  label?: string;
};

export function StatusBadge({ tone, label }: StatusBadgeProps) {
  const conf = toneMap[tone];
  return (
    <Badge variant="secondary" className={cn("gap-1", conf.className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {label ?? conf.label}
    </Badge>
  );
}
