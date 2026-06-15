import { Loader2 } from "lucide-react";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  message: string;
  sublabel?: string;
};

export function NavigationLoadingOverlay({ message, sublabel }: Props) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/55 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border border-emerald-200/80 bg-background/95 px-6 py-4 shadow-lg",
          dashboardUi.body
        )}
      >
        <span className="inline-flex items-center gap-2 font-medium text-emerald-900">
          <Loader2
            className={cn(dashboardUi.iconSm, "animate-spin")}
            aria-hidden
          />
          {message}
        </span>
        {sublabel ? (
          <span className={cn("text-muted-foreground", dashboardUi.tableMeta)}>
            {sublabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
