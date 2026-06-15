import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import type { ModuleReceipt } from "@/lib/data/iot";
import { isValidFarmKey } from "@/lib/data/barn-catalog";
import { formatKst } from "@/lib/datetime/kst";
import { farmKeyId } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

function fmtTime(iso: string): string {
  return formatKst(iso, "short");
}

export function RecentActivityList({
  receipts = [],
  variant = "default",
}: {
  receipts?: ModuleReceipt[];
  variant?: "default" | "compact";
}) {
  const items = receipts
    .filter((r) => isValidFarmKey(r.farmKey))
    .slice(0, variant === "compact" ? 4 : 6);
  return (
    <SectionCard
      title="최근 활동"
      description={variant === "compact" ? undefined : "통신박스별 센서 수신"}
      className={
        variant === "compact"
          ? cn("h-full w-full", dashboardUi.overviewPanelMinH)
          : undefined
      }
      contentClassName={
        variant === "compact" ? "flex flex-1 flex-col min-h-0" : undefined
      }
    >
      {items.length === 0 ? (
        <p className={cn("py-6 text-center", dashboardUi.body, "text-muted-foreground")}>
          최근 수신 데이터가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-1 flex-col justify-center space-y-4">
          {items.map((r) => (
            <li
              key={`${farmKeyId(r.farmKey)}-${r.moduleUid}`}
              className="flex items-center gap-3"
            >
              <StatusBadge tone={r.status} large />
              <span className={cn("min-w-0 flex-1", dashboardUi.body)}>
                {farmShortLabel(r.farmKey)} · 통신박스{" "}
                {r.moduleUid} 센서 수신
              </span>
              <span className={cn("shrink-0", dashboardUi.tableMeta)}>
                {fmtTime(r.receivedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
