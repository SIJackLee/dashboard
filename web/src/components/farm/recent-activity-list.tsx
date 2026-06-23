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
        <ul className="flex flex-1 flex-col justify-center space-y-2 lg:space-y-4">
          {items.map((r) => (
            <li
              key={`${farmKeyId(r.farmKey)}-${r.moduleUid}`}
              className={cn(
                "flex gap-2",
                variant === "compact"
                  ? "flex-col rounded-lg border bg-muted/10 p-2.5 lg:flex-row lg:items-center lg:gap-3 lg:border-0 lg:bg-transparent lg:p-0"
                  : "flex-col rounded-lg border bg-muted/10 p-3 lg:flex-row lg:items-center lg:gap-3 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
              )}
            >
              <div className="flex min-w-0 flex-1 items-start gap-2 lg:items-center">
                <span className="lg:hidden">
                  <StatusBadge tone={r.status} compact />
                </span>
                <span className="hidden shrink-0 lg:inline-flex">
                  <StatusBadge tone={r.status} large />
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1",
                    variant === "compact"
                      ? "text-sm leading-snug lg:text-base"
                      : dashboardUi.body
                  )}
                >
                  {farmShortLabel(r.farmKey)} · 통신박스 {r.moduleUid} 센서 수신
                </span>
              </div>
              <span className="shrink-0 pl-7 text-xs text-muted-foreground lg:pl-0">
                {fmtTime(r.receivedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
