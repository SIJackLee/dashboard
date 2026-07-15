import type { ReactNode } from "react";
import { Cpu, Bell, Tractor, WifiOff } from "lucide-react";
import type { FarmOverview } from "@/lib/data/iot";
import { cn } from "@/lib/utils";

const fmt = (n?: number) => (n === undefined ? "--" : String(n));

function Kpi({
  icon,
  label,
  value,
  unit,
  alert,
  mobileLayout = false,
  iconBadge = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  alert?: boolean;
  mobileLayout?: boolean;
  /** 아이콘 카드 + 우상단 숫자 배지 */
  iconBadge?: boolean;
}) {
  if (iconBadge || mobileLayout) {
    return (
      <div
        className="flex shrink-0 flex-col items-center gap-0.5 px-0.5 pt-1"
        title={`${label} ${value}${unit ?? ""}`}
        aria-label={`${label} ${value}${unit ?? ""}`}
      >
        <div className="relative size-9 shrink-0">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-xl border bg-background/95 [&_svg]:size-4",
              alert
                ? "border-red-300/60 bg-red-50/80 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
                : "border-border/80 text-muted-foreground"
            )}
          >
            {icon}
          </span>
          <span
            className={cn(
              "absolute right-0 top-0 z-[1] flex min-h-[1rem] min-w-[1rem] -translate-y-1/3 translate-x-1/3 items-center justify-center rounded-full border-2 border-background px-0.5 text-[9px] font-bold leading-none tabular-nums",
              alert
                ? "bg-red-500 text-white"
                : "bg-emerald-600 text-white"
            )}
            suppressHydrationWarning
          >
            {value}
          </span>
        </div>
        <p className="max-w-[3.25rem] truncate text-center text-[9px] leading-none text-muted-foreground">
          {label}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "grid min-w-[5.5rem] grid-cols-[auto_1fr] grid-rows-[auto_auto] items-center gap-x-2 gap-y-0.5 rounded-lg border bg-background/90 px-2 py-1.5 sm:min-w-[7.25rem] sm:gap-x-2.5 sm:px-3 sm:py-2 md:min-w-[6.5rem]",
        alert &&
          "border-red-300/60 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
      )}
    >
      <span
        className={cn(
          "col-start-1 row-span-2 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground sm:size-10 [&_svg]:size-4 sm:[&_svg]:size-[1.35rem]",
          alert &&
            "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400"
        )}
      >
        {icon}
      </span>
      <p className="col-start-2 row-start-1 truncate text-[10px] leading-none text-muted-foreground sm:text-xs md:text-sm">
        {label}
      </p>
      <p
        className={cn(
          "col-start-2 row-start-2 truncate text-base font-semibold tabular-nums leading-tight sm:text-lg md:text-[1.5rem]",
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
  /** max-md에서 KPI 가로 스크롤 (admin 전국 뷰 등) */
  compact = false,
  /** 모바일 전용 — 헤더 2행 하단 스트립 (레거시) */
  mobileLayout = false,
  /** TopBar 1행 인라인 — 농장·컨트롤러·오프라인 */
  headerInline = false,
}: {
  overview?: FarmOverview;
  alarmCount?: number;
  /** Admin 전국 지도 등 — 운영 KPI TopBar 미표시 */
  hidden?: boolean;
  compact?: boolean;
  mobileLayout?: boolean;
  headerInline?: boolean;
}) {
  if (hidden) {
    return <div className="min-w-0 flex-1 max-lg:hidden" aria-hidden />;
  }

  const offline = overview?.offlineCount ?? 0;
  const alarms = alarmCount ?? 0;

  const kpis = (
    <>
      <Kpi
        icon={<Tractor aria-hidden />}
        label="농장"
        value={fmt(overview?.farmCount)}
      />
      <Kpi
        icon={<Cpu aria-hidden />}
        label="컨트롤러"
        value={fmt(overview?.controllerCount)}
      />
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
    </>
  );

  if (headerInline) {
    return (
      <div className="flex shrink-0 items-end justify-end gap-1 overflow-x-auto overscroll-x-contain px-0.5 pb-0.5 pt-1.5 [scrollbar-width:none] max-lg:[overflow-y:visible]">
        <Kpi
          iconBadge
          icon={<Tractor aria-hidden />}
          label="농장"
          value={fmt(overview?.farmCount)}
        />
        <Kpi
          iconBadge
          icon={<Cpu aria-hidden />}
          label="컨트롤러"
          value={fmt(overview?.controllerCount)}
        />
        <Kpi
          iconBadge
          icon={<WifiOff aria-hidden />}
          label="오프라인"
          value={fmt(overview?.offlineCount)}
          alert={offline > 0}
        />
      </div>
    );
  }

  if (mobileLayout) {
    return (
      <div className="flex w-full items-center justify-center gap-3">
        <Kpi
          iconBadge
          icon={<Tractor aria-hidden />}
          label="농장"
          value={fmt(overview?.farmCount)}
        />
        <Kpi
          iconBadge
          icon={<Cpu aria-hidden />}
          label="컨트롤러"
          value={fmt(overview?.controllerCount)}
        />
        <Kpi
          iconBadge
          icon={<WifiOff aria-hidden />}
          label="오프라인"
          value={fmt(overview?.offlineCount)}
          alert={offline > 0}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center justify-center px-1 md:px-2",
        compact && "max-lg:hidden"
      )}
    >
      <div
        className={cn(
          "inline-flex max-w-full items-stretch justify-center gap-1.5 rounded-xl border bg-muted/15 p-1.5 sm:gap-2 sm:p-2",
          "max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:overscroll-x-contain max-lg:[scrollbar-width:none] lg:flex-wrap",
          compact && "max-lg:hidden"
        )}
        data-tour-id="header-stats"
      >
        {kpis}
      </div>
    </div>
  );
}
