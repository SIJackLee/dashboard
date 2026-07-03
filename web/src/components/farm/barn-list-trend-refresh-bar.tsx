"use client";

import { RefreshScopeShell } from "@/components/common/refresh-scope-shell";
import { RefreshActionButton } from "@/components/common/refresh-action-button";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  onRefresh: () => void;
  busy?: boolean;
  showSpinner?: boolean;
  showProgress?: boolean;
  error?: boolean;
};

export function BarnListTrendRefreshBar({
  onRefresh,
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
          error ? "justify-between" : "justify-end",
          dashboardUi.body,
        )}
        data-audit-region="barn-list-trend-refresh-bar"
      >
        {error ? (
          <p className="text-xs text-destructive sm:text-sm">불러오기 실패</p>
        ) : null}
        <RefreshActionButton
          onClick={onRefresh}
          loading={busy}
          showSpinner={showSpinner}
        />
      </div>
    </RefreshScopeShell>
  );
}
