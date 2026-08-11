"use client";

import { useMemo } from "react";
import { StatusBadge } from "@/components/common/status-badge";
import { isValidFarmKey } from "@/lib/data/barn-catalog";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { formatKst } from "@/lib/datetime/kst";
import type { ModuleReceipt } from "@/lib/data/iot";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Props = {
  activeFarmKey: FarmKey | null;
  receipts: ModuleReceipt[];
  onOpenActivity?: () => void;
};

export function AccountMenuSummary({
  activeFarmKey,
  receipts,
  onOpenActivity,
}: Props) {
  const summary = useMemo(() => {
    const valid = receipts.filter((r) => isValidFarmKey(r.farmKey));
    const scoped =
      activeFarmKey != null
        ? valid.find((r) => farmKeyId(r.farmKey) === farmKeyId(activeFarmKey))
        : valid[0];
    const receipt = scoped ?? valid[0];
    if (!receipt) return null;
    const farmKey = activeFarmKey ?? receipt.farmKey;
    return {
      farmKey,
      farmLabel: farmShortLabel(farmKey),
      status: receipt.status,
      timeLabel: formatKst(receipt.receivedAt, "short"),
    };
  }, [activeFarmKey, receipts]);

  if (!summary) return null;

  const inner = (
    <>
      <StatusBadge tone={summary.status} compact />
      <span className="min-w-0 truncate font-medium">{summary.farmLabel}</span>
      <span className="shrink-0 text-muted-foreground">{summary.timeLabel}</span>
    </>
  );

  if (onOpenActivity) {
    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-2 border-b bg-muted/40 px-4 py-2 text-left",
          dashboardUi.tableMeta,
          motionClass.microInteractive,
        )}
        data-tour-id="account-menu-summary"
        aria-label={`최근 활동 · ${summary.farmLabel} · ${summary.timeLabel}`}
        onClick={onOpenActivity}
      >
        {inner}
        <span className="ml-auto shrink-0 text-primary">활동 ›</span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b bg-muted/40 px-4 py-2",
        dashboardUi.tableMeta,
      )}
      data-tour-id="account-menu-summary"
    >
      {inner}
    </div>
  );
}
