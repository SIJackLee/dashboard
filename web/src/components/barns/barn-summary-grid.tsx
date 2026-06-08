import { Warehouse, CheckCircle2, AlertTriangle, WifiOff } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import type { BarnSummary } from "@/lib/data/iot";

// 통신 기준 집계 (정상/주의/오프라인). 모드·전원 데이터는 없으므로 통신 상태 중심.
export function BarnSummaryGrid({ summary }: { summary?: BarnSummary }) {
  const fmt = (n?: number) => (n === undefined ? "--" : String(n));
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="총 컨트롤러 수" icon={Warehouse} value={fmt(summary?.total)} />
      <StatCard
        label="정상"
        icon={CheckCircle2}
        accent="emerald"
        value={fmt(summary?.normal)}
      />
      <StatCard
        label="주의"
        icon={AlertTriangle}
        accent="amber"
        value={fmt(summary?.caution)}
      />
      <StatCard
        label="오프라인"
        icon={WifiOff}
        value={fmt(summary?.offline)}
      />
    </div>
  );
}
