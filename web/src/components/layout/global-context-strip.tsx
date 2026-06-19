import type { ReactNode } from "react";
import { Cpu, Bell, Tractor, WifiOff } from "lucide-react";
import type { FarmOverview } from "@/lib/data/iot";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const fmt = (n?: number) => (n === undefined ? "--" : String(n));

function Kpi({
  icon,
  label,
  value,
  unit,
  alert,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  alert?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid min-w-[6.5rem] grid-cols-[auto_1fr] grid-rows-[auto_auto] items-center gap-x-2.5 gap-y-0.5 rounded-lg border bg-background/90 px-2.5 py-2 sm:min-w-[7.25rem] sm:px-3",
        alert && "border-red-300/60 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
      )}
    >
      <span
        className={cn(
          "col-start-1 row-span-2 flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground [&_svg]:size-[1.35rem]",
          alert && "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
        )}
      >
        {icon}
      </span>
      <p
        className={cn(
          "col-start-2 row-start-1 truncate leading-none",
          dashboardUi.tableMeta
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          "col-start-2 row-start-2 truncate font-semibold tabular-nums leading-tight",
          "text-[1.5rem] sm:text-[1.65rem]",
          alert && "text-red-600 dark:text-red-400"
        )}
        suppressHydrationWarning
      >
        {value}
        {unit ? (
          <span className="ml-0.5 text-[0.72em] font-medium text-muted-foreground">
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
}

/** TopBar scoped 스냅샷 — 농장·컨트롤러·오프라인·알람 (온습은 본문/패널 전용) */
export function GlobalContextStrip({
  overview,
  alarmCount,
  hidden = false,
}: {
  overview?: FarmOverview;
  alarmCount?: number;
  /** Admin 전국 지도 등 — 운영 KPI TopBar 미표시 */
  hidden?: boolean;
}) {
  if (hidden) {
    return <div className="min-w-0 flex-1" aria-hidden />;
  }

  const offline = overview?.offlineCount ?? 0;
  const alarms = alarmCount ?? 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-1 md:px-2">
      <div
        className={cn(
          "inline-flex max-w-full flex-wrap items-stretch justify-center gap-1.5 rounded-xl border bg-muted/15 p-1.5 sm:gap-2 sm:p-2"
        )}
      >
        <Kpi icon={<Tractor aria-hidden />} label="농장" value={fmt(overview?.farmCount)} />
        <Kpi icon={<Cpu aria-hidden />} label="컨트롤러" value={fmt(overview?.controllerCount)} />
        <Kpi
          icon={<WifiOff aria-hidden />}
          label="오프라인"
          value={fmt(overview?.offlineCount)}
          alert={offline > 0}
        />
        <Kpi
          icon={<Bell aria-hidden />}
          label="알람"
          value={fmt(alarmCount)}
          alert={alarms > 0}
        />
      </div>
    </div>
  );
}
