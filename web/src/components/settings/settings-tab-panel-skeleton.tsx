import { Loader2 } from "lucide-react";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  message: string;
};

export function SettingsTabPanelSkeleton({ message }: Props) {
  return (
    <div className="flex min-h-[12rem] items-center justify-center rounded-xl border bg-muted/10">
      <p
        className={cn(
          "inline-flex items-center gap-2 text-muted-foreground",
          dashboardUi.body
        )}
      >
        <Loader2 className={cn(dashboardUi.iconSm, "animate-spin")} aria-hidden />
        {message}
      </p>
    </div>
  );
}
