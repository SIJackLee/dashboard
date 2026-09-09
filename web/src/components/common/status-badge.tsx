import { Badge } from "@/components/ui/badge";
import {
  statusFillDanger,
  statusFillOk,
  statusFillWarn,
} from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type StatusTone = "normal" | "caution" | "warning" | "offline";

const toneMap: Record<StatusTone, { label: string; className: string }> = {
  normal: { label: "정상", className: statusFillOk },
  caution: { label: "주의", className: statusFillWarn },
  warning: { label: "경고", className: statusFillDanger },
  offline: { label: "오프라인", className: "bg-muted text-muted-foreground" },
};

type StatusBadgeProps = {
  tone: StatusTone;
  label?: string;
  /** 지도 카드 등 좁은 공간용 */
  compact?: boolean;
  /** 컨트롤러 페이지 등 큰 글씨 */
  large?: boolean;
};

export function StatusBadge({ tone, label, compact, large }: StatusBadgeProps) {
  const conf = toneMap[tone];
  const text = label ?? conf.label;
  return (
    <Badge
      variant="secondary"
      className={cn(
        "shrink-0 max-w-full !h-auto leading-none",
        compact && !large && "gap-1 px-1.5 py-0 text-[10px]",
        compact && large && "gap-1.5 px-3 py-1 text-lg font-medium min-h-[2rem]",
        !compact && !large && "gap-1",
        !compact && large && "gap-2 px-4 py-1.5 text-2xl font-medium min-h-[2.5rem]",
        conf.className
      )}
    >
      <span
        className={cn(
          "shrink-0 rounded-full bg-current",
          large && !compact && "size-3",
          large && compact && "size-2.5",
          !large && "size-1.5"
        )}
      />
      <span className={cn(compact && "truncate")}>{text}</span>
    </Badge>
  );
}
