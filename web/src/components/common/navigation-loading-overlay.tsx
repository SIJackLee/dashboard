import Image from "next/image";
import { Loader2 } from "lucide-react";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type NavOverlayVariant = "spinner" | "brand";

type Props = {
  message: string;
  sublabel?: string;
  variant?: NavOverlayVariant;
  /** brand variant — 언마운트 직전 150ms 페이드아웃 */
  exiting?: boolean;
};

export function NavigationLoadingOverlay({
  message,
  sublabel,
  variant = "spinner",
  exiting = false,
}: Props) {
  if (variant === "brand") {
    return (
      <div
        className={cn(
          "fixed inset-0 z-[9999] flex items-center justify-center bg-background",
          exiting && "login-splash--exit"
        )}
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-5">
          <Image
            src="/logo.png"
            alt=""
            width={240}
            height={96}
            priority
            className="login-splash-logo h-16 w-auto sm:h-20"
          />
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="login-splash-dot size-2 rounded-full bg-emerald-600" />
            <span className="login-splash-dot size-2 rounded-full bg-emerald-600" />
            <span className="login-splash-dot size-2 rounded-full bg-emerald-600" />
          </div>
          <span className="sr-only">{message}</span>
        </div>
      </div>
    );
  }

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
