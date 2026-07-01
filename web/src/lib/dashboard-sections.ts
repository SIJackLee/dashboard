/** 모니터링 허브 — /farm + ?tab=map|ops */
export const MONITORING_SECTION = {
  href: "/farm",
  label: "모니터링",
} as const;

/** 사이드바에 노출되는 앱 섹션 (운영 /admin 제외) */
export const APP_NAV_SECTIONS = [MONITORING_SECTION] as const;

export type AppNavSection = (typeof APP_NAV_SECTIONS)[number];

/** 모니터링 허브 경로 (레거시 /controllers·/alarms·/play 포함) */
export function isMonitoringNavPath(pathname: string): boolean {
  return (
    pathname.startsWith("/farm") ||
    pathname.startsWith("/controllers") ||
    pathname.startsWith("/alarms") ||
    pathname.startsWith("/play")
  );
}

/** Admin 운영 허브 (레거시 /admin/health·/admin/users·drill-down 포함) */
export function isAdminOpsNavPath(pathname: string): boolean {
  return (
    pathname.startsWith("/admin/ops") ||
    pathname.startsWith("/admin/health") ||
    pathname.startsWith("/admin/users")
  );
}
