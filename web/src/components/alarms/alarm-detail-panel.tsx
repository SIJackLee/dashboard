import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import type { AlarmRow } from "@/lib/data/alarms";

export function AlarmDetailPanel({ alarm }: { alarm?: AlarmRow }) {
  if (!alarm) {
    return (
      <SectionCard title="알람 상세">
        <p className="text-sm text-muted-foreground">선택된 알람 없음</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="최신 알람">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">유형</dt>
          <dd>{alarm.alarmType}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">심각도</dt>
          <dd>
            <Badge variant={alarm.severity === "critical" ? "destructive" : "secondary"}>
              {alarm.severity}
            </Badge>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">컨트롤러</dt>
          <dd>
            idx {alarm.idx} ({alarm.eqpmnNo})
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">상세</dt>
          <dd className="mt-1">{alarm.detail}</dd>
        </div>
      </dl>
    </SectionCard>
  );
}
