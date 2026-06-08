import { SectionCard } from "@/components/common/section-card";
import type { BarnSummary } from "@/lib/data/iot";
import { cn } from "@/lib/utils";

const SEGMENTS = [
  { key: "normal" as const, label: "정상", color: "stroke-emerald-500", dot: "bg-emerald-500" },
  { key: "caution" as const, label: "주의", color: "stroke-amber-500", dot: "bg-amber-500" },
  { key: "offline" as const, label: "오프라인", color: "stroke-muted-foreground/40", dot: "bg-muted-foreground/50" },
];

type BarnStatusDonutProps = {
  summary?: BarnSummary;
};

export function BarnStatusDonut({ summary }: BarnStatusDonutProps) {
  const counts = {
    normal: summary?.normal ?? 0,
    caution: summary?.caution ?? 0,
    offline: summary?.offline ?? 0,
  };
  const total = counts.normal + counts.caution + counts.offline;

  if (total === 0) {
    return (
      <SectionCard title="축사 상태 분포" description="컨트롤러 통신 상태">
        <p className="py-10 text-center text-sm text-muted-foreground">
          표시할 데이터가 없습니다
        </p>
      </SectionCard>
    );
  }

  const r = 40;
  const c = 2 * Math.PI * r;
  const arcs = SEGMENTS.reduce<
    { key: string; dash: number; offset: number; color: string }[]
  >((acc, seg) => {
    const value = counts[seg.key];
    if (value === 0) return acc;
    const dash = (value / total) * c;
    const offset = acc.reduce((sum, a) => sum + a.dash, 0);
    acc.push({ key: seg.key, dash, offset, color: seg.color });
    return acc;
  }, []);

  return (
    <SectionCard title="축사 상태 분포" description="컨트롤러 통신 상태">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative shrink-0">
          <svg viewBox="0 0 100 100" className="size-36 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="12"
              className="text-muted/30"
            />
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                strokeWidth="12"
                strokeDasharray={`${arc.dash} ${c - arc.dash}`}
                strokeDashoffset={-arc.offset}
                className={cn(arc.color)}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums">{total}</span>
            <span className="text-xs text-muted-foreground">전체</span>
          </div>
        </div>
        <ul className="w-full space-y-2 text-sm">
          {SEGMENTS.map((seg) => {
            const value = counts[seg.key];
            const pct = total ? Math.round((value / total) * 100) : 0;
            return (
              <li key={seg.key} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className={cn("size-2.5 rounded-full", seg.dot)} />
                  {seg.label}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {value}
                  <span className="ml-1 text-xs">({pct}%)</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </SectionCard>
  );
}
