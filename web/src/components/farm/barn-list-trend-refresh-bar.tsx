"use client";

import { RefreshCw } from "lucide-react";
import { PageActionButton } from "@/components/common/page-action-button";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  onRefresh: () => void;
  loading?: boolean;
  error?: boolean;
};

export function BarnListTrendRefreshBar({
  onRefresh,
  loading = false,
  error = false,
}: Props) {
  return (
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
      <PageActionButton
        icon={
          <RefreshCw
            className={cn(dashboardUi.iconSm, loading && "animate-spin")}
            aria-hidden
          />
        }
        onClick={onRefresh}
        disabled={loading}
      >
        새로고침
      </PageActionButton>
    </div>
  );
}
