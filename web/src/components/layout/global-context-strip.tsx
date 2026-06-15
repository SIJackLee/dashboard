import type { ReactNode } from "react";
import {
  Cpu,
  Bell,
  Droplets,
  Thermometer,
  Tractor,
  WifiOff,
} from "lucide-react";
import type { FarmOverview } from "@/lib/data/iot";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const fmt = (n?: number) => (n === undefined ? "--" : String(n));
const fmtNum = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "--" : v.toFixed(digits);

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

/** 모든 페이지 TopBar — 농장 요약 + 환경 평균 */
export function GlobalContextStrip({
  overview,
  alarmCount,
}: {
  overview?: FarmOverview;
  alarmCount?: number;
}) {
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
        <span className="hidden w-px shrink-0 self-stretch bg-border sm:block" aria-hidden />
        <Kpi
          icon={<Thermometer aria-hidden />}
          label="온도"
          value={fmtNum(overview?.avgTempC)}
          unit="℃"
        />
        <Kpi
          icon={<Droplets aria-hidden />}
          label="습도"
          value={fmtNum(overview?.avgHumidityPct)}
          unit="%"
        />
      </div>
      <p className={cn("mt-1 text-muted-foreground", dashboardUi.tableMeta)}>
        온·습도: 온라인 컨트롤러 평균
      </p>
    </div>
  );
}
