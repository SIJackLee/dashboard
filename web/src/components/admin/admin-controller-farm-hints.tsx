"use client";

import { AppNavLink } from "@/components/layout/app-nav-link";
import { useMemo } from "react";
import { AlertTriangle, WifiOff } from "lucide-react";
import {
  buildControllerHref,
  buildFarmAlarmsHref,
} from "@/lib/auth/farm-access";
import {
  farmLabel,
  farmShortLabel,
  type FarmSummaryRow,
} from "@/lib/data/farm-summaries";
import { farmKeyId } from "@/lib/data/farm-key";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  farms: FarmSummaryRow[];
  /** 오프라인·알람 상위 농장만 (기본 5) */
  limit?: number;
  /** ops deep link — alarms: farm scope only */
  targetTab?: "ops" | "alarms";
};

export function AdminControllerFarmHints({
  farms,
  limit = 5,
  targetTab = "ops",
}: Props) {
  const highlights = useMemo(() => {
    return [...farms]
      .filter((f) => f.offlineCount > 0 || f.alarmCount > 0)
      .sort((a, b) => {
        const scoreA = a.offlineCount * 10 + a.alarmCount;
        const scoreB = b.offlineCount * 10 + b.alarmCount;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }, [farms, limit]);

  if (highlights.length === 0) {
    return (
      <div className="rounded-xl border bg-muted/20 px-4 py-3">
        <p className={cn("text-muted-foreground", dashboardUi.body)}>
          전체 농장 모드 · 현재 이상 징후가 있는 농장이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-300/40 bg-amber-50/30 px-4 py-4 dark:bg-amber-950/20">
      <p className={cn("font-medium", dashboardUi.body)}>
        전체 농장 모드 · 이상 농장 바로가기
      </p>
      <p className={cn("mt-1 text-muted-foreground", dashboardUi.tableMeta)}>
        ScopeBar에서 농장을 선택하거나 아래 링크로 이동하세요.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {highlights.map((farm) => {
          const href =
            targetTab === "alarms"
              ? buildFarmAlarmsHref(farm.farmKey)
              : buildControllerHref({ farmKey: farm.farmKey });

          return (
            <AppNavLink
              key={farmKeyId(farm.farmKey)}
              href={href}
              message="컨트롤러 탭으로 이동 중…"
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 transition-colors hover:border-emerald-400/60 hover:bg-emerald-50/40",
                dashboardUi.body
              )}
            >
              <span className="font-medium">{farmShortLabel(farm.farmKey)}</span>
              {farm.offlineCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-red-600">
                  <WifiOff className="size-3.5" aria-hidden />
                  {farm.offlineCount}
                </span>
              ) : null}
              {farm.alarmCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  {farm.alarmCount}
                </span>
              ) : null}
              <span className="hidden text-muted-foreground sm:inline">
                {farmLabel(farm.farmKey)}
              </span>
            </AppNavLink>
          );
        })}
      </div>
    </div>
  );
}
