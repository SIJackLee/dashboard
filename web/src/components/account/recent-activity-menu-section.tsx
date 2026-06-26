"use client";

import type { ModuleReceipt } from "@/lib/data/iot";
import { StatusBadge } from "@/components/common/status-badge";
import { isValidFarmKey } from "@/lib/data/barn-catalog";
import { farmKeyId } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { formatKst } from "@/lib/datetime/kst";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  receipts: ModuleReceipt[];
  max?: number;
};

export function RecentActivityMenuSection({ receipts, max = 4 }: Props) {
  const items = receipts
    .filter((r) => isValidFarmKey(r.farmKey))
    .slice(0, max);

  return (
    <div className="px-2 py-1.5">
      <p className={cn("px-2 pb-1 font-medium", dashboardUi.tableMeta)}>최근 활동</p>
      {items.length === 0 ? (
        <p className={cn("px-2 py-2 text-muted-foreground", dashboardUi.tableMeta)}>
          최근 수신 데이터가 없습니다.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((r) => (
            <li
              key={`${farmKeyId(r.farmKey)}-${r.moduleUid}`}
              className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm"
            >
              <StatusBadge tone={r.status} compact />
              <div className="min-w-0 flex-1">
                <p className="leading-snug">
                  {farmShortLabel(r.farmKey)} · M{r.moduleUid}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatKst(r.receivedAt, "short")}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
