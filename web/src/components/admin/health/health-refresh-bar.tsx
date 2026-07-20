"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HEALTH_REVALIDATE_SEC } from "@/lib/admin/health/constants";
import { formatHealthTime } from "@/lib/admin/health/format-health-time";
import { dashboardControl, dashboardTypography, opsControl } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthRefreshBarProps = {
  fetchedAt: string;
  className?: string;
  /** 운영 스캔 바 — 갱신 버튼만 (타이머는 title). */
  compact?: boolean;
};

export function HealthRefreshBar({
  fetchedAt,
  className,
  compact = false,
}: HealthRefreshBarProps) {
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
          queueMicrotask(() => router.refresh());
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
  const countdown = `${mins}:${secs.toString().padStart(2, "0")}`;
  const title = `스캔·사용자·명령 전체 재검증 · 갱신 ${fetchedLabel} · ${countdown} 후`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={refresh}
        title={title}
        aria-label={title}
        className={cn(opsControl.buttonOutline, "border", className)}
      >
        갱신
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3",
        className,
      )}
    >
      <p className={cn(dashboardTypography.meta, "min-w-0")}>{title}</p>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-9 min-h-9 w-full text-sm sm:h-auto sm:min-h-0 sm:w-auto",
          dashboardControl.buttonOutline,
        )}
        onClick={refresh}
      >
        지금 갱신
      </Button>
    </div>
  );
}
