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
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type FarmSwitcherProps = {
  farmOptions: FarmKey[];
  activeFarmKey: FarmKey | null;
  farmSummaries?: FarmSummaryRow[];
};

/** useSearchParams — 클라이언트 마운트 후 렌더로 hydration 불일치 방지 */
export function FarmSwitcher(props: FarmSwitcherProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn("min-h-[3rem] max-w-full", dashboardUi.body)}
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
}: FarmSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
          "inline-flex shrink-0 items-center gap-3 rounded-xl px-5 py-2 font-medium transition-colors",
          dashboardUi.body,
          activeId === null
            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        aria-label="농장 선택"
      >
        <span>{triggerLabel}</span>
        <ChevronDown className="size-8 shrink-0 opacity-70" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className={cn(
          "min-w-[28rem] p-2 text-[1.75rem] leading-snug rounded-xl",
          "!w-auto"
        )}
      >
        <DropdownMenuItem
          onClick={() => navigate(null)}
          className={cn(
            "gap-3 rounded-lg px-3 py-2.5 text-[1.75rem] leading-snug",
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
                "gap-3 rounded-lg px-3 py-2.5 text-[1.75rem] leading-snug",
                activeId === id && "bg-emerald-50 dark:bg-emerald-950/30"
              )}
            >
              <span className="flex-1">{farmShortLabel(farmKey)}</span>
              {alarms !== undefined ? (
                <span
                  className={cn(
                    "tabular-nums text-[1.75rem] font-semibold leading-snug",
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
