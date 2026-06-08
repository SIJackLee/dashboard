import { cn } from "@/lib/utils";

type SparklineProps = {
  /** 10-포인트 추이 (%) — 데이터 매칭 추후. 비우면 placeholder */
  data?: number[];
  className?: string;
};

// 의존성 없이 SVG polyline 으로 표현하는 가벼운 스파크라인 골격.
export function Sparkline({ data = [], className }: SparklineProps) {
  const width = 100;
  const height = 28;

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex h-7 items-center justify-center rounded bg-muted/50 text-[10px] text-muted-foreground",
          className
        )}
      >
        추이 데이터 추후 매칭
      </div>
    );
  }

  const max = Math.max(...data, 100);
  const step = width / Math.max(data.length - 1, 1);
  const points = data
    .map((v, i) => `${i * step},${height - (v / max) * height}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-7 w-full text-emerald-500", className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
