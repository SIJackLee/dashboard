import type { HealthErrorAction } from "@/lib/admin/health/d11-map";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  error: HealthErrorAction;
  className?: string;
};

export function HealthErrorActionLines({ error, className }: Props) {
  return (
    <div
      className={cn("space-y-0.5", className)}
      title={error.codeTitle}
      aria-label={`ERROR TYPE ${error.type} RECOMMEND ${error.action}`}
    >
      <p className={dashboardTypography.meta}>
        <span className="text-muted-foreground">ERROR TYPE : </span>
        {error.type}
      </p>
      <p className={dashboardTypography.meta}>
        <span className="text-muted-foreground">RECOMMEND : </span>
        {error.action}
      </p>
    </div>
  );
}
