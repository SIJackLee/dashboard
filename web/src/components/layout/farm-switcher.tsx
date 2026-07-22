"use client";

import { useMemo, useSyncExternalStore, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  appendFarmKeyParams,
  farmKeyId,
  type FarmKey,
} from "@/lib/data/farm-key";
import {
  farmShortLabel,
  type FarmSummaryRow,
} from "@/lib/data/farm-summaries";
import { replaceFarmUrlShallow } from "@/lib/farm/farm-view-url";
import { useAdminHubPanelsOptional } from "@/lib/navigation/admin-hub-panels-context";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

type FarmSwitcherProps = {
  farmOptions: FarmKey[];
  activeFarmKey: FarmKey | null;
  farmSummaries?: FarmSummaryRow[];
  /** OpsScopeBar — compact pill trigger */
  compact?: boolean;
};

/** useSearchParams — 클라이언트 마운트 후 렌더로 hydration 불일치 방지 */
export function FarmSwitcher(props: FarmSwitcherProps) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) {
    return (
      <div
        className={cn(
          "max-w-full",
          props.compact ? "min-h-[3.25rem]" : "min-h-[3rem]",
          !props.compact && dashboardUi.body
        )}
        aria-hidden
      />
    );
  }

  return <FarmSwitcherBody {...props} />;
}

function FarmSwitcherBody({
  farmOptions,
  activeFarmKey,
  farmSummaries = [],
  compact = false,
}: FarmSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hubPanels = useAdminHubPanelsOptional();
  const { navigate: appNavigate, isPending: navPending } = useAppNavigate();
  const [shallowPending, startShallowTransition] = useTransition();
  const switchPending = navPending || shallowPending;

  const alarmByFarmId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of farmSummaries) {
      map.set(farmKeyId(row.farmKey), row.alarmCount);
    }
    return map;
  }, [farmSummaries]);

  const liveByFarmId = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const row of farmSummaries) {
      map.set(farmKeyId(row.farmKey), row.controllerCount > 0);
    }
    return map;
  }, [farmSummaries]);

  const orderedFarmOptions = useMemo(() => {
    if (liveByFarmId.size === 0) return farmOptions;
    return [...farmOptions].sort((a, b) => {
      const aLive = liveByFarmId.get(farmKeyId(a)) === true ? 0 : 1;
      const bLive = liveByFarmId.get(farmKeyId(b)) === true ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return farmKeyId(a).localeCompare(farmKeyId(b));
    });
  }, [farmOptions, liveByFarmId]);

  const navigate = (farmKey: FarmKey | null) => {
    if (switchPending) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lsind");
    params.delete("item");

    if (farmKey) {
      appendFarmKeyParams(params, farmKey);
      if (pathname === "/farm") {
        params.delete("view");
      }
    } else if (pathname === "/farm") {
      params.delete("view");
      params.delete("sp");
    }

    const query = params.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    const useShallow =
      pathname === "/farm" &&
      hubPanels?.ready === true &&
      hubPanels.panels.length > 0;

    if (useShallow) {
      startShallowTransition(() => {
        replaceFarmUrlShallow(params);
        hubPanels.notifyHubUrlChange();
      });
      return;
    }

    appNavigate(href, { message: "농장 전환 중…" });
  };

  if (farmOptions.length === 0) return null;

  const activeId = activeFarmKey ? farmKeyId(activeFarmKey) : null;
  const triggerLabel =
    activeFarmKey === null
      ? `전체 ${farmOptions.length}개 농장`
      : farmShortLabel(activeFarmKey);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={switchPending}
        aria-busy={switchPending || undefined}
        className={cn(
          "inline-flex shrink-0 items-center gap-2 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait disabled:opacity-80",
          compact
            ? cn(
                dashboardUi.scopePill,
                dashboardUi.scopePillText,
                dashboardUi.scopePillActive
              )
            : cn(
                "gap-3 rounded-xl px-5 py-2",
                dashboardUi.body,
                activeId === null
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
        )}
        aria-label={switchPending ? "농장 전환 중" : "농장 선택"}
      >
        <span className={compact ? "max-w-[18rem] truncate" : undefined}>
          {switchPending ? "전환 중…" : triggerLabel}
        </span>
        {switchPending ? (
          <Loader2
            className={cn(
              "shrink-0 animate-spin opacity-70",
              compact ? "size-6" : "size-8"
            )}
            aria-hidden
          />
        ) : (
          <ChevronDown
            className={cn(
              "shrink-0 opacity-70",
              compact ? "size-6" : "size-8"
            )}
            aria-hidden
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn(
          compact
            ? cn(dashboardUi.scopePillMenu, "!w-auto min-w-[var(--anchor-width)]")
            : "min-w-[28rem] rounded-xl p-2 text-sm leading-snug md:text-[1.75rem] !w-auto"
        )}
      >
        <DropdownMenuItem
          onClick={() => navigate(null)}
          className={cn(
            compact
              ? dashboardUi.scopePillMenuItem
              : "gap-3 rounded-lg px-3 py-2.5 text-sm leading-snug md:text-[1.75rem]",
            activeId === null && "bg-emerald-50 dark:bg-emerald-950/30"
          )}
        >
          <span className="flex-1 font-medium">
            전체 {farmOptions.length}개 농장
          </span>
        </DropdownMenuItem>
        {orderedFarmOptions.map((farmKey) => {
          const id = farmKeyId(farmKey);
          const alarms = alarmByFarmId.get(id);
          const hasLiveSummary = liveByFarmId.has(id);
          const isLive = liveByFarmId.get(id) === true;
          return (
            <DropdownMenuItem
              key={id}
              onClick={() => navigate(farmKey)}
              className={cn(
                compact
                  ? dashboardUi.scopePillMenuItem
                  : "gap-3 rounded-lg px-3 py-2.5 text-sm leading-snug md:text-[1.75rem]",
                activeId === id && "bg-emerald-50 dark:bg-emerald-950/30"
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate">{farmShortLabel(farmKey)}</span>
                {hasLiveSummary ? (
                  isLive ? (
                    <span className="shrink-0 rounded border border-emerald-500/40 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                      LIVE
                    </span>
                  ) : (
                    <span className="shrink-0 rounded border border-amber-500/40 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                      위치만
                    </span>
                  )
                ) : null}
              </span>
              {alarms !== undefined ? (
                <span
                  className={cn(
                    "tabular-nums font-semibold",
                    "text-sm leading-snug md:text-[1.75rem]",
                    alarms > 0
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-muted-foreground"
                  )}
                >
                  {alarms}
                </span>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
