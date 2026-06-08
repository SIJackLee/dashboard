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
  /** 지도 카드 등 좁은 공간용 */
  compact?: boolean;
};

export function StatusBadge({ tone, label, compact }: StatusBadgeProps) {
  const conf = toneMap[tone];
  const text = label ?? conf.label;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1 shrink-0 max-w-full",
        compact && "px-1.5 py-0 text-[10px]",
        conf.className
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      <span className={cn(compact && "truncate")}>{text}</span>
    </Badge>
  );
}
