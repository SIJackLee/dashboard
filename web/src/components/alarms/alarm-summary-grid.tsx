import { AlertOctagon, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";

export function AlarmSummaryGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="긴급" sub="즉시 조치 필요" icon={AlertOctagon} accent="red" />
      <StatCard label="경고" sub="주의가 필요" icon={AlertTriangle} accent="amber" />
      <StatCard label="확인대기" sub="확인 중인 알람" icon={Clock} accent="sky" />
      <StatCard label="해결완료" sub="해결된 알람" icon={CheckCircle2} accent="emerald" />
    </div>
  );
}
