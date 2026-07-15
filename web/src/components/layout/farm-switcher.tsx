"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
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
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type FarmSwitcherProps = {
  farmOptions: FarmKey[];
  activeFarmKey: FarmKey | null;
  farmSummaries?: FarmSummaryRow[];
  /** OpsScopeBar — compact pill trigger */
  compact?: boolean;
};

/** useSearchParams — 클라이언트 마운트 후 렌더로 hydration 불일치 방지 */
export function FarmSwitcher(props: FarmSwitcherProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hubPanels = useAdminHubPanelsOptional();

  const alarmByFarmId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of farmSummaries) {
      map.set(farmKeyId(row.farmKey), row.alarmCount);
    }
    return map;
  }, [farmSummaries]);

  const navigate = (farmKey: FarmKey | null) => {
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
    const useShallow =
      pathname === "/farm" &&
      hubPanels?.ready === true &&
      hubPanels.panels.length > 0;

    if (useShallow) {
      replaceFarmUrlShallow(params);
      hubPanels.notifyHubUrlChange();
      return;
    }

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
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
        className={cn(
          "inline-flex shrink-0 items-center gap-2 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
        aria-label="농장 선택"
      >
        <span className={compact ? "max-w-[18rem] truncate" : undefined}>
          {triggerLabel}
        </span>
        <ChevronDown
          className={cn(
            "shrink-0 opacity-70",
            compact ? "size-6" : "size-8"
          )}
          aria-hidden
        />
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
        {farmOptions.map((farmKey) => {
          const id = farmKeyId(farmKey);
          const alarms = alarmByFarmId.get(id);
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
              <span className="flex-1">{farmShortLabel(farmKey)}</span>
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
