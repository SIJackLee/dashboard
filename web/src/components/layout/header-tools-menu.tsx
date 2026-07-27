"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  Bell,
  Cpu,
  EllipsisVertical,
  Monitor,
  Moon,
  ShieldCheck,
  Smartphone,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { DailyReportButton } from "@/components/layout/daily-report-button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AlarmRow } from "@/lib/data/alarms";
import { alarmControlHref } from "@/lib/data/alarms";
import type { FarmKey } from "@/lib/data/farm-key";
import type { FarmOverview } from "@/lib/data/iot";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { formatKst } from "@/lib/datetime/kst";
import { isAdminOpsNavPath } from "@/lib/dashboard-sections";
import { monitoringHref } from "@/lib/monitoring/monitoring-tabs";
import { formatControllerSlotLabel } from "@/lib/ui/controller-labels";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import {
  getViewportPreference,
  getViewportPreviewMode,
  setViewportPreviewMode,
  subscribeViewportPreview,
  type ViewportPreviewMode,
} from "@/lib/ui/viewport-preview-store";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { FARM_TOUR_ACTION_EVENT } from "@/lib/onboarding/tour-steps";
import {
  afterFrames,
  dispatchTourGridActionDone,
  waitForTourTarget,
} from "@/lib/onboarding/tour-timing";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const emptySubscribe = () => () => {};

const MODE_LABEL: Record<ViewportPreviewMode, string> = {
  mobile: "모바일 레이아웃",
  desktop: "PC 레이아웃",
};

type Props = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  isAdmin?: boolean;
  farmKey?: FarmKey | null;
};

function connectivityMessage(overview?: FarmOverview): string {
  const registered = overview?.controllerCount;
  if (registered === undefined) {
    return "컨트롤러 연결 정보를 불러올 수 없습니다.";
  }
  const offline = overview?.offlineCount ?? 0;
  const connected =
    overview?.connectedCount ?? Math.max(registered - offline, 0);
  return `${registered}개 중 ${connected}개 연결`;
}

function ToolsIconChip({
  Icon,
  alert = false,
  className,
}: {
  Icon: LucideIcon;
  alert?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        dashboardUi.headerToolsCardIcon,
        alert && dashboardUi.headerToolsCardIconAlert,
        className,
      )}
      aria-hidden
    >
      <Icon className="size-4 md:size-5" />
    </span>
  );
}

function ToolsCardShell({
  children,
  alert = false,
  className,
  tourId,
}: {
  children: ReactNode;
  alert?: boolean;
  className?: string;
  tourId?: string;
}) {
  return (
    <div
      className={cn(
        dashboardUi.headerToolsCard,
        alert && dashboardUi.headerToolsCardAlert,
        className,
      )}
      data-tour-id={tourId}
    >
      {children}
    </div>
  );
}

/**
 * 헤더 도구 — 알림 → 기능 → 스타일 순, 트리거(⋮) 왼쪽으로 슬라이드.
 * 카드·아이콘 칩은 헤더 버튼(rounded-lg border)과 동일 계열.
 */
export function HeaderToolsMenu({
  overview,
  alarms = [],
  isAdmin = false,
  farmKey = null,
}: Props) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const viewportCompact = useHydrationSafeDashboardCompact();
  const { navigate } = useAppNavigate();
  const pathname = usePathname();

  const registered = overview?.controllerCount;
  const offline = overview?.offlineCount ?? 0;
  const activeAlarms = alarms.filter((a) => a.status === "active");
  const alarmCount = activeAlarms.length;
  const alarmPreview = activeAlarms.slice(0, 4);
  const alert = offline > 0 || alarmCount > 0;
  const badgeCount = alarmCount > 0 ? alarmCount : offline > 0 ? offline : 0;

  const onOps = isAdminOpsNavPath(pathname);
  const opsHref = onOps ? "/farm" : "/admin/ops";

  const viewportMode = useSyncExternalStore(
    subscribeViewportPreview,
    getViewportPreviewMode,
    () => "desktop" as ViewportPreviewMode,
  );
  const viewportPref = useSyncExternalStore(
    subscribeViewportPreview,
    getViewportPreference,
    () => "auto" as const,
  );
  const viewportIsMobile = viewportMode === "mobile";
  const ViewportIcon = viewportIsMobile ? Monitor : Smartphone;
  const nextViewport: ViewportPreviewMode = viewportIsMobile
    ? "desktop"
    : "mobile";

  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const onTourAction = (e: Event) => {
      const action = (e as CustomEvent<{ action?: string }>).detail?.action;
      if (action === "open-header-tools") setMenuOpen(true);
      if (action === "close-header-tools") setMenuOpen(false);
    };
    window.addEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
    return () =>
      window.removeEventListener(FARM_TOUR_ACTION_EVENT, onTourAction);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    void (async () => {
      await afterFrames(2);
      await waitForTourTarget('[data-tour-id="header-tools-panel"]');
      dispatchTourGridActionDone("open-header-tools");
    })();
  }, [menuOpen]);

  useEffect(() => {
    queueMicrotask(() => {
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light",
      );
      setThemeReady(true);
    });
  }, []);
  const themeIsDark = theme === "dark";

  const trigger = (
    <>
      <EllipsisVertical className="size-4 md:size-5" aria-hidden />
      {badgeCount > 0 ? (
        <span
          className={cn(
            dashboardUi.topHeaderCountBadge,
            dashboardUi.topHeaderCountBadgeAlert,
          )}
          suppressHydrationWarning
        >
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </>
  );

  if (!mounted) {
    return (
      <button
        type="button"
        className={cn(
          dashboardUi.topHeaderActionBtn,
          alert && dashboardUi.topHeaderActionBtnAlert,
        )}
        data-tour-id="header-tools"
        aria-label="헤더 도구"
        title="헤더 도구"
      >
        {trigger}
      </button>
    );
  }

  return (
    <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
      <DropdownMenuTrigger
        className={cn(
          dashboardUi.topHeaderActionBtn,
          alert && dashboardUi.topHeaderActionBtnAlert,
        )}
        data-tour-id="header-tools"
        aria-label="헤더 도구"
        title="알림 · 기능 · 스타일"
      >
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="left"
        sideOffset={10}
        alignOffset={0}
        data-mobile-viewport-dropdown={viewportCompact || undefined}
        data-tour-id="header-tools-panel"
        className={cn(
          motionClass.headerToolsPanel,
          "w-[min(100vw-1rem,20rem)] p-2 md:w-[22rem]",
          "animate-none data-open:animate-none data-closed:animate-none",
        )}
      >
        <DropdownMenuGroup className="header-tools-section">
          <DropdownMenuLabel className="px-2 py-1.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
            알림
          </DropdownMenuLabel>
          <ToolsCardShell
            tourId="header-connectivity"
            alert={offline > 0}
          >
            <ToolsIconChip Icon={Cpu} alert={offline > 0} />
            <div className={dashboardUi.headerToolsCardBody}>
              <div className={dashboardUi.headerToolsCardTitle}>
                <span>컨트롤러 연결</span>
                {registered !== undefined ? (
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {registered}
                  </span>
                ) : null}
              </div>
              <p className={dashboardUi.headerToolsCardMeta}>
                {connectivityMessage(overview)}
              </p>
              {offline > 0 ? (
                <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                  오프라인 {offline}개
                </p>
              ) : null}
            </div>
          </ToolsCardShell>
          <ToolsCardShell
            tourId="header-alarms"
            alert={alarmCount > 0}
          >
            <ToolsIconChip Icon={Bell} alert={alarmCount > 0} />
            <div className={dashboardUi.headerToolsCardBody}>
              <div className={dashboardUi.headerToolsCardTitle}>
                <span>센서 알림</span>
                {alarmCount > 0 ? (
                  <Badge
                    variant="destructive"
                    className="ml-auto h-5 min-h-0 px-1.5 text-[0.65rem]"
                  >
                    {alarmCount}건
                  </Badge>
                ) : null}
              </div>
              {alarmPreview.length === 0 ? (
                <p className={dashboardUi.headerToolsCardMeta}>
                  센서 알림 없음
                </p>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {alarmPreview.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className={cn(
                          "w-full rounded-md border border-transparent px-1.5 py-1.5 text-left hover:border-border hover:bg-muted/80",
                          motionClass.microInteractive,
                        )}
                        onClick={() =>
                          navigate(alarmControlHref(a), {
                            message: "컨트롤러 제어로 이동 중…",
                          })
                        }
                      >
                        <span className="flex items-center justify-between gap-2 text-xs font-medium">
                          <span className="truncate">{a.alarmType}</span>
                          <span className="shrink-0 text-[0.65rem] text-muted-foreground">
                            {a.severity === "critical" ? "심각" : "주의"}
                          </span>
                        </span>
                        <span className="block truncate text-[0.65rem] text-muted-foreground">
                          {a.stallTyCode
                            ? formatStallTypeLabel(a.stallTyCode)
                            : "—"}{" "}
                          ·{" "}
                          {formatControllerSlotLabel({
                            stallNo: a.stallNo,
                            eqpmnNo: a.eqpmnNo,
                            idx: a.idx,
                          })}
                        </span>
                        <span className="block text-[0.65rem] text-muted-foreground">
                          {formatKst(a.occurredAt, "short")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {alarmCount > 0 ? (
                <DropdownMenuItem
                  className="mt-1.5 justify-center rounded-lg border text-xs font-medium text-emerald-700"
                  onClick={() =>
                    navigate(monitoringHref("ops"), {
                      message: "이상 탭으로 이동 중…",
                    })
                  }
                >
                  {alarmCount > alarmPreview.length
                    ? `센서 알림 ${alarmCount}건 보기`
                    : "이상 탭으로 이동"}
                </DropdownMenuItem>
              ) : null}
            </div>
          </ToolsCardShell>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1.5" />

        <DropdownMenuGroup className="header-tools-section">
          <DropdownMenuLabel className="px-2 py-1.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
            기능
          </DropdownMenuLabel>
          {isAdmin ? (
            <AppNavLink
              href={opsHref}
              message={
                onOps ? "모니터링으로 이동 중…" : "운영으로 이동 중…"
              }
              className={cn(
                dashboardUi.headerToolsCard,
                "mb-1 no-underline",
                onOps &&
                  "border-emerald-600/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300",
                motionClass.microInteractive,
              )}
              aria-label={onOps ? "운영 종료 — 모니터링으로" : "운영"}
              title={onOps ? "운영 → 모니터링" : "모니터링 → 운영"}
              data-tour-id="header-ops"
            >
              <ToolsIconChip
                Icon={ShieldCheck}
                className={
                  onOps
                    ? "border-emerald-600/50 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300"
                    : undefined
                }
              />
              <div className={dashboardUi.headerToolsCardBody}>
                <div className={dashboardUi.headerToolsCardTitle}>
                  {onOps ? "모니터링으로" : "운영"}
                </div>
                <p className={dashboardUi.headerToolsCardMeta}>
                  {onOps ? "운영 화면 종료" : "시스템 · 사용자 · 명령"}
                </p>
              </div>
            </AppNavLink>
          ) : null}
          <div>
            <DailyReportButton
              farmKey={farmKey}
              alarmCount={alarms.length}
              presentation="tools-card"
            />
          </div>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1.5" />

        <DropdownMenuGroup className="header-tools-section">
          <DropdownMenuLabel className="px-2 py-1.5 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
            스타일
          </DropdownMenuLabel>
          <DropdownMenuItem
            className={cn(
              dashboardUi.headerToolsCard,
              "cursor-pointer data-highlighted:bg-muted/50",
              viewportIsMobile && "border-primary/60 bg-primary/5 text-primary",
            )}
            data-tour-id="viewport-preview-toggle"
            onClick={() => setViewportPreviewMode(nextViewport)}
          >
            <ToolsIconChip
              Icon={ViewportIcon}
              className={
                viewportIsMobile
                  ? "border-primary/50 text-primary"
                  : undefined
              }
            />
            <div className={dashboardUi.headerToolsCardBody}>
              <div className={dashboardUi.headerToolsCardTitle}>
                <span className="min-w-0 flex-1 truncate">
                  {MODE_LABEL[viewportMode]}
                  {viewportPref === "auto" ? " (자동)" : ""}
                </span>
              </div>
              <p className={dashboardUi.headerToolsCardMeta}>
                → {MODE_LABEL[nextViewport]}
              </p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn(
              dashboardUi.headerToolsCard,
              "mt-0 cursor-pointer data-highlighted:bg-muted/50",
            )}
            data-tour-id="header-theme"
            data-theme-ready={themeReady || undefined}
            onClick={() => {
              const next = themeIsDark ? "light" : "dark";
              document.documentElement.classList.toggle("dark", next === "dark");
              localStorage.setItem("dashboard-theme", next);
              setTheme(next);
            }}
          >
            <ToolsIconChip Icon={themeIsDark ? Sun : Moon} />
            <div className={dashboardUi.headerToolsCardBody}>
              <div className={dashboardUi.headerToolsCardTitle}>
                {themeIsDark ? "라이트 모드" : "다크 모드"}
              </div>
              <p className={dashboardUi.headerToolsCardMeta}>
                화면 밝기 전환
              </p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
