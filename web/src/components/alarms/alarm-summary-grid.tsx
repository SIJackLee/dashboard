import { AlertTriangle, Bell, WifiOff } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";

type Summary = {
  total: number;
  critical: number;
  warning: number;
  offline: number;
};

export function AlarmSummaryGrid({ summary }: { summary?: Summary }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="전체" icon={Bell} value={String(summary?.total ?? 0)} />
      <StatCard
        label="심각"
        icon={AlertTriangle}
        accent="red"
        value={String(summary?.critical ?? 0)}
      />
      <StatCard
        label="주의"
        icon={AlertTriangle}
        accent="sky"
        value={String(summary?.warning ?? 0)}
      />
      <StatCard
        label="통신 두절"
        icon={WifiOff}
        value={String(summary?.offline ?? 0)}
      />
    </div>
  );
}
