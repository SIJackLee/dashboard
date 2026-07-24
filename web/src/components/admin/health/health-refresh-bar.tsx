"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { HEALTH_REVALIDATE_SEC } from "@/lib/admin/health/constants";
import { formatHealthTime } from "@/lib/admin/health/format-health-time";
import {
  dashboardControl,
  dashboardTypography,
  opsControl,
} from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthRefreshBarProps = {
  fetchedAt: string;
  className?: string;
  /** 운영 스캔 바 — 갱신 버튼만 (타이머는 title). */
  compact?: boolean;
  /** 스냅샷 부분 패치 — 없으면 no-op */
  onRefresh?: () => void | Promise<void>;
};

export function HealthRefreshBar({
  fetchedAt,
  className,
  compact = false,
  onRefresh,
}: HealthRefreshBarProps) {
  const [secondsLeft, setSecondsLeft] = useState(HEALTH_REVALIDATE_SEC);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const refresh = useCallback(() => {
    if (!onRefresh || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    void Promise.resolve(onRefresh())
      .catch(() => {
        /* 호출측 처리 */
      })
      .finally(() => {
        pendingRef.current = false;
        setPending(false);
        setSecondsLeft(HEALTH_REVALIDATE_SEC);
      });
  }, [onRefresh]);

  useEffect(() => {
    if (!onRefresh) return;
    const id = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      setSecondsLeft((s) => {
        if (s <= 1) {
          // pendingRef 가드가 있는 refresh()로 — 주기 갱신 중첩 방지
          queueMicrotask(() => refresh());
          return HEALTH_REVALIDATE_SEC;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [onRefresh, refresh]);

  const fetchedLabel = formatHealthTime(fetchedAt);
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const countdown = `${mins}:${secs.toString().padStart(2, "0")}`;
  const title = `스캔·사용자·명령 스냅샷 갱신 · 갱신 ${fetchedLabel} · ${countdown} 후`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={refresh}
        disabled={pending || !onRefresh}
        title={title}
        aria-label={title}
        className={cn(opsControl.buttonOutline, "border", className)}
      >
        {pending ? "갱신 중…" : "갱신"}
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
        disabled={pending || !onRefresh}
        className={cn(
          "h-9 min-h-9 w-full text-sm sm:h-auto sm:min-h-0 sm:w-auto",
          dashboardControl.buttonOutline,
        )}
        onClick={refresh}
      >
        {pending ? "갱신 중…" : "지금 갱신"}
      </Button>
    </div>
  );
}
