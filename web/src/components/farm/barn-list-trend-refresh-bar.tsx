"use client";

import { RefreshScopeShell } from "@/components/common/refresh-scope-shell";
import { RefreshActionButton } from "@/components/common/refresh-action-button";
import {
  TREND_PERIODS,
  type TrendPeriodId,
} from "@/lib/data/farm-trend-types";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const PERIOD_ORDER: TrendPeriodId[] = ["24h", "7d", "30d"];

type Props = {
  onRefresh: () => void;
  bulkPeriod: TrendPeriodId;
  onBulkPeriodChange: (period: TrendPeriodId) => void;
  busy?: boolean;
  showSpinner?: boolean;
  showProgress?: boolean;
  error?: boolean;
};

export function BarnListTrendRefreshBar({
  onRefresh,
  bulkPeriod,
  onBulkPeriodChange,
  busy = false,
  showSpinner = false,
  showProgress = false,
  error = false,
}: Props) {
  return (
    <RefreshScopeShell busy={busy} showProgress={showProgress}>
      <div
        className={cn(
          "mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2",
          error ? "justify-between" : "justify-between",
          dashboardUi.body,
        )}
        data-audit-region="barn-list-trend-refresh-bar"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground sm:text-sm">
            전체 기간
          </span>
          <div
            className="inline-flex shrink-0 overflow-x-auto rounded-md border bg-background"
            role="group"
            aria-label="전체 기간"
          >
            {PERIOD_ORDER.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onBulkPeriodChange(p)}
                className={cn(
                  "shrink-0 px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                  bulkPeriod === p
                    ? "bg-sky-50 text-sky-700"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {TREND_PERIODS[p].label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {error ? (
            <p className="text-xs text-destructive sm:text-sm">불러오기 실패</p>
          ) : null}
          <RefreshActionButton
            onClick={onRefresh}
            loading={busy}
            showSpinner={showSpinner}
          />
        </div>
      </div>
    </RefreshScopeShell>
  );
}
