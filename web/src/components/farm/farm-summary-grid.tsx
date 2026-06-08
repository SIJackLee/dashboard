import { Warehouse, Cpu, Boxes, Bell } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";

export function FarmSummaryGrid() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <StatCard label="전체 축사" icon={Warehouse} accent="emerald" />
      <StatCard label="온라인 모듈" icon={Boxes} accent="sky" />
      <StatCard label="연결된 컨트롤러" icon={Cpu} />
      <StatCard label="알람 상태" icon={Bell} accent="red" />
    </div>
  );
}
