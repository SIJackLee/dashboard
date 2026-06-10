import { SectionCard } from "@/components/common/section-card";
import type { LogEvent } from "@/lib/data/iot-replay";

export function HourlyEventChart({ events }: { events: LogEvent[] }) {
  const replayCount = events.filter((e) => e.eventType === "replay_burst").length;

  return (
    <SectionCard title="이벤트 요약" description="REPLAY burst 기준">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">REPLAY burst</p>
          <p className="text-2xl font-semibold">{replayCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs text-muted-foreground">전체 이벤트</p>
          <p className="text-2xl font-semibold">{events.length}</p>
        </div>
      </div>
    </SectionCard>
  );
}
