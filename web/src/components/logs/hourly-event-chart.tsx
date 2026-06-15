import { SectionCard } from "@/components/common/section-card";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import type { LogEvent } from "@/lib/data/iot-replay";

export function HourlyEventChart({ events }: { events: LogEvent[] }) {
  const replayCount = events.filter((e) => e.eventType === "replay_burst").length;

  return (
    <SectionCard title="이벤트 요약" description="REPLAY burst 기준">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={dashboardUi.metricTile}>
          <p className={dashboardUi.statLabel}>REPLAY burst</p>
          <p className={dashboardUi.statValue}>{replayCount}</p>
        </div>
        <div className={dashboardUi.metricTile}>
          <p className={dashboardUi.statLabel}>전체 이벤트</p>
          <p className={dashboardUi.statValue}>{events.length}</p>
        </div>
      </div>
    </SectionCard>
  );
}
