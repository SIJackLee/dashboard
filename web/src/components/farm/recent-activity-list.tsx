import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";

// 최근 활동(센서 수신/명령) 골격. 항목은 추후 매칭.
export function RecentActivityList() {
  return (
    <SectionCard
      title="최근 활동"
      action={
        <button className="text-xs text-muted-foreground hover:text-foreground">
          더보기
        </button>
      }
    >
      <ul className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3">
            <StatusBadge tone="normal" />
            <span className="flex-1 truncate text-sm text-muted-foreground">
              활동 내용 (데이터 추후 매칭)
            </span>
            <span className="text-xs text-muted-foreground">--:--</span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
