import { Warehouse, CheckCircle2, AlertTriangle, WifiOff } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";

// 통신 기준 집계 (정상/주의/오프라인). 모드·전원 데이터는 없으므로 통신 상태 중심.
export function BarnSummaryGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="총 축사 수" icon={Warehouse} />
      <StatCard label="정상 축사" icon={CheckCircle2} accent="emerald" />
      <StatCard label="주의 축사" icon={AlertTriangle} accent="amber" />
      <StatCard label="오프라인 축사" icon={WifiOff} />
    </div>
  );
}
