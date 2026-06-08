import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

type ChartPlaceholderProps = {
  label?: string;
  height?: number;
  className?: string;
};

// 차트 라이브러리/데이터 매칭 전, 영역만 잡아두는 골격 컴포넌트.
export function ChartPlaceholder({
  label = "차트 영역 (데이터 추후 매칭)",
  height = 220,
  className,
}: ChartPlaceholderProps) {
  return (
    <div
      style={{ height }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/30 text-muted-foreground",
        className
      )}
    >
      <BarChart3 className="size-6" />
      <span className="text-xs">{label}</span>
    </div>
  );
}
