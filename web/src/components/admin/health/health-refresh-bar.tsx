"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HEALTH_REVALIDATE_SEC } from "@/lib/admin/health/constants";
import { formatHealthTime } from "@/lib/admin/health/format-health-time";
import { dashboardControl, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthRefreshBarProps = {
  fetchedAt: string;
  className?: string;
};

export function HealthRefreshBar({ fetchedAt, className }: HealthRefreshBarProps) {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(HEALTH_REVALIDATE_SEC);

  const refresh = useCallback(() => {
    router.refresh();
    setSecondsLeft(HEALTH_REVALIDATE_SEC);
  }, [router]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          router.refresh();
          return HEALTH_REVALIDATE_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [router]);

  const fetchedLabel = formatHealthTime(fetchedAt);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <p className={dashboardTypography.meta}>
        갱신 {fetchedLabel} · {mins}:{secs.toString().padStart(2, "0")} 후
      </p>
      <Button
        type="button"
        variant="outline"
        className={dashboardControl.buttonOutline}
        onClick={refresh}
      >
        지금 갱신
      </Button>
    </div>
  );
}
