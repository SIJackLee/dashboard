import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import type { ModuleReceipt } from "@/lib/data/iot";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  });
}

// 최근 활동(센서 수신): 통신박스별 최신 수신 시각
export function RecentActivityList({
  receipts = [],
}: {
  receipts?: ModuleReceipt[];
}) {
  const items = receipts.slice(0, 6);
  return (
    <SectionCard title="최근 활동" description="통신박스별 센서 수신">
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          최근 수신 데이터가 없습니다.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((r) => (
            <li
              key={`${r.farmUid}-${r.moduleUid}`}
              className="flex items-center gap-3"
            >
              <StatusBadge tone={r.status} />
              <span className="flex-1 truncate text-sm">
                농장 {r.farmUid} · 통신박스 {r.moduleUid} 센서 수신
              </span>
              <span className="text-xs text-muted-foreground">
                {fmtTime(r.receivedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
