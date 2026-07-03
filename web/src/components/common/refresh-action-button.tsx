"use client";

import { RefreshCw } from "lucide-react";
import { PageActionButton } from "@/components/common/page-action-button";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  loading?: boolean;
  showSpinner?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
};

/** ScopeBar · BarnListTrendRefreshBar 등 refresh 버튼 통일 */
export function RefreshActionButton({
  onClick,
  loading = false,
  showSpinner = false,
  disabled,
  children = "새로고침",
  className,
}: Props) {
  return (
    <PageActionButton
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={className}
      icon={
        <RefreshCw
          className={cn(dashboardUi.iconSm, showSpinner && "animate-spin")}
          aria-hidden
        />
      }
    >
      {children}
    </PageActionButton>
  );
}
