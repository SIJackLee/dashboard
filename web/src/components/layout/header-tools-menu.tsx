"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Bell,
  Cpu,
  EllipsisVertical,
  FileText,
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
  DropdownMenuItem,
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

const emptySubscribe = () => () => {};

type Props = {
  overview?: FarmOverview;
  alarms?: AlarmRow[];
  isAdmin?: boolean;
  farmKey?: FarmKey | null;
};

type DetailId = "connectivity" | "alarms" | "report";

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

function toolsIconStyle(toolsI: number): CSSProperties {
  return { ["--tools-i" as string]: toolsI } as CSSProperties;
}

function ToolsIconWrap({
  toolsI,
  children,
}: {
  toolsI: number;
  children: ReactNode;
}) {
  return (
    <span className="header-tools-icon inline-flex" style={toolsIconStyle(toolsI)}>
      {children}
    </span>
  );
}

function ToolsIconBtn({
  Icon,
  alert = false,
  active = false,
  badge,
  className,
  ...rest
}: {
  Icon: LucideIcon;
  alert?: boolean;
  active?: boolean;
  badge?: number;
  className?: string;
} & ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        dashboardUi.topHeaderActionBtn,
        alert && dashboardUi.topHeaderActionBtnAlert,
        active &&
          "border-primary/60 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary",
        className,
      )}
      {...rest}
    >
      <Icon className="size-4 md:size-5" aria-hidden />
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            dashboardUi.topHeaderCountBadge,
            dashboardUi.topHeaderCountBadgeAlert,
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

/**
 * 헤더 도구 — 아이콘 캐스케이드 + 클릭 시 상세 카드(펼침 유지).
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
  const [detail, setDetail] = useState<DetailId | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const onTourAction = (e: Event) => {
      const action = (e as CustomEvent<{ action?: string }>).detail?.action;
      if (action === "open-header-tools") setMenuOpen(true);
      if (action === "close-header-tools") {
        setMenuOpen(false);
        setDetail(null);
      }
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

  const connTitle = connectivityMessage(overview);
  const viewportTitle =
    viewportMode === "mobile"
      ? `모바일 레이아웃${viewportPref === "auto" ? " (자동)" : ""} → PC`
      : `PC 레이아웃${viewportPref === "auto" ? " (자동)" : ""} → 모바일`;

  const toolsMax = isAdmin ? 5 : 4;
  const iTheme = 0;
  const iViewport = 1;
  const iReport = 2;
  const iOps = 3;
  const iBell = isAdmin ? 4 : 3;
  const iCpu = isAdmin ? 5 : 4;

  const toggleDetail = (id: DetailId) => {
    setDetail((prev) => (prev === id ? null : id));
  };

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
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(open) => {
        setMenuOpen(open);
        if (!open) setDetail(null);
      }}
    >
      <DropdownMenuTrigger
        className={cn(
          dashboardUi.topHeaderActionBtn,
          alert && dashboardUi.topHeaderActionBtnAlert,
        )}
        data-tour-id="header-tools"
        aria-label="헤더 도구"
        title="헤더 도구"
      >
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="left"
        sideOffset={8}
        alignOffset={0}
        data-mobile-viewport-dropdown={viewportCompact || undefined}
        data-tour-id="header-tools-panel"
        style={{ ["--tools-max" as string]: toolsMax } as CSSProperties}
        className={cn(
          motionClass.headerToolsPanel,
          "min-w-0 w-auto border-0 bg-transparent p-0 shadow-none ring-0",
          "animate-none data-open:animate-none data-closed:animate-none",
          "data-open:zoom-in-100 data-closed:zoom-out-100",
        )}
      >
        <div className="flex flex-col items-end gap-2">
          <div
            className="flex flex-row flex-nowrap items-center justify-end gap-1.5"
            role="toolbar"
            aria-label="헤더 도구"
          >
            <ToolsIconWrap toolsI={iCpu}>
              <ToolsIconBtn
                Icon={Cpu}
                alert={offline > 0}
                active={detail === "connectivity"}
                badge={offline > 0 ? offline : undefined}
                data-tour-id="header-connectivity"
                aria-label="컨트롤러 연결"
                aria-pressed={detail === "connectivity"}
                title="컨트롤러 연결"
                onClick={() => toggleDetail("connectivity")}
              />
            </ToolsIconWrap>
            <ToolsIconWrap toolsI={iBell}>
              <ToolsIconBtn
                Icon={Bell}
                alert={alarmCount > 0}
                active={detail === "alarms"}
                badge={alarmCount > 0 ? alarmCount : undefined}
                data-tour-id="header-alarms"
                aria-label={
                  alarmCount > 0
                    ? `센서 알림 ${alarmCount}건`
                    : "센서 알림"
                }
                aria-pressed={detail === "alarms"}
                title="센서 알림"
                onClick={() => toggleDetail("alarms")}
              />
            </ToolsIconWrap>
            {isAdmin ? (
              <ToolsIconWrap toolsI={iOps}>
                <AppNavLink
                  href={opsHref}
                  message={
                    onOps ? "모니터링으로 이동 중…" : "운영으로 이동 중…"
                  }
                  className={cn(
                    dashboardUi.topHeaderActionBtn,
                    "no-underline",
                    onOps &&
                      "border-emerald-600/60 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300",
                  )}
                  aria-label={onOps ? "운영 종료 — 모니터링으로" : "운영"}
                  title={onOps ? "운영 → 모니터링" : "모니터링 → 운영"}
                  data-tour-id="header-ops"
                >
                  <ShieldCheck className="size-4 md:size-5" aria-hidden />
                </AppNavLink>
              </ToolsIconWrap>
            ) : null}
            <ToolsIconWrap toolsI={iReport}>
              <ToolsIconBtn
                Icon={FileText}
                active={detail === "report"}
                data-tour-id="header-daily-report"
                aria-label="오늘의 리포트"
                aria-pressed={detail === "report"}
                title="오늘의 리포트"
                onClick={() => toggleDetail("report")}
              />
            </ToolsIconWrap>
            <ToolsIconWrap toolsI={iViewport}>
              <DropdownMenuItem
                closeOnClick={false}
                className={cn(
                  dashboardUi.topHeaderActionBtn,
                  "cursor-pointer p-0 data-highlighted:bg-muted",
                  viewportIsMobile &&
                    "border-primary/60 bg-primary/5 text-primary",
                )}
                data-tour-id="viewport-preview-toggle"
                aria-label={viewportTitle}
                title={viewportTitle}
                onClick={() => setViewportPreviewMode(nextViewport)}
              >
                <ViewportIcon className="size-4 md:size-5" aria-hidden />
              </DropdownMenuItem>
            </ToolsIconWrap>
            <ToolsIconWrap toolsI={iTheme}>
              <DropdownMenuItem
                closeOnClick={false}
                className={cn(
                  dashboardUi.topHeaderActionBtn,
                  "cursor-pointer p-0 data-highlighted:bg-muted",
                )}
                data-tour-id="header-theme"
                data-theme-ready={themeReady || undefined}
                aria-label={themeIsDark ? "라이트 모드" : "다크 모드"}
                title={themeIsDark ? "라이트 모드" : "다크 모드"}
                onClick={() => {
                  const next = themeIsDark ? "light" : "dark";
                  document.documentElement.classList.toggle(
                    "dark",
                    next === "dark",
                  );
                  localStorage.setItem("dashboard-theme", next);
                  setTheme(next);
                }}
              >
                {themeIsDark ? (
                  <Sun className="size-4 md:size-5" aria-hidden />
                ) : (
                  <Moon className="size-4 md:size-5" aria-hidden />
                )}
              </DropdownMenuItem>
            </ToolsIconWrap>
          </div>

          {detail ? (
            <div
              className={cn(
                "w-[min(100vw-2rem,20rem)] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
                motionClass.enterFade,
              )}
              data-tour-id={`header-tools-detail-${detail}`}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {detail === "connectivity" ? (
                <div
                  className={cn(
                    dashboardUi.headerToolsCard,
                    "mx-0 mb-0 w-full",
                    offline > 0 && dashboardUi.headerToolsCardAlert,
                  )}
                >
                  <span
                    className={cn(
                      dashboardUi.headerToolsCardIcon,
                      offline > 0 && dashboardUi.headerToolsCardIconAlert,
                    )}
                    aria-hidden
                  >
                    <Cpu className="size-4 md:size-5" />
                  </span>
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
                      {connTitle}
                    </p>
                    {offline > 0 ? (
                      <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                        오프라인 {offline}개
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {detail === "alarms" ? (
                <div
                  className={cn(
                    dashboardUi.headerToolsCard,
                    "mx-0 mb-0 w-full",
                    alarmCount > 0 && dashboardUi.headerToolsCardAlert,
                  )}
                >
                  <span
                    className={cn(
                      dashboardUi.headerToolsCardIcon,
                      alarmCount > 0 && dashboardUi.headerToolsCardIconAlert,
                    )}
                    aria-hidden
                  >
                    <Bell className="size-4 md:size-5" />
                  </span>
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
                        closeOnClick
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
                </div>
              ) : null}

              {detail === "report" ? (
                <div className="p-1">
                  <DailyReportButton
                    farmKey={farmKey}
                    alarmCount={alarms.length}
                    presentation="tools-card"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
