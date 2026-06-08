import { FileText, Bell, Send, Wifi } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";

export function LogSummaryGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="오늘 로그 수" sub="전일 대비" icon={FileText} accent="emerald" />
      <StatCard label="알람 로그" sub="전일 대비" icon={Bell} accent="red" />
      <StatCard label="명령 로그" sub="전일 대비" icon={Send} accent="sky" />
      <StatCard label="데이터 수신율" sub="전일 대비" icon={Wifi} />
    </div>
  );
}
