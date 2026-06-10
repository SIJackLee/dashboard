import { ScrollText, History } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import type { LogEvent } from "@/lib/data/iot-replay";

export function LogSummaryGrid({ events }: { events: LogEvent[] }) {
  const replay = events.filter((e) => e.eventType === "replay_burst").length;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="전체 이벤트" icon={ScrollText} value={String(events.length)} />
      <StatCard label="REPLAY burst" icon={History} accent="sky" value={String(replay)} />
    </div>
  );
}
