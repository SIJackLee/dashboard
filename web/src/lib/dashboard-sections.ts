import { PIGGY_PLAY_ENABLED } from "@/lib/feature-flags";
import type { DisplaySettingKey } from "@/lib/data/display-settings-shared";

/** 모니터링 허브 — /farm + ?tab=map|devices|alarms */
export const MONITORING_SECTION = {
  href: "/farm",
  label: "모니터링",
  linkedDisplayPageIds: ["farm", "controller", "alarm"] as const,
} as const;

/** 사이드바에 노출되는 앱 섹션 (운영 /admin 제외) */
export const APP_NAV_SECTIONS = [
  MONITORING_SECTION,
  {
    href: "/play",
    label: "오락",
    linkedDisplayPageIds: [] as const,
    requiresPiggy: true,
  },
] as const;

export type AppNavSection = (typeof APP_NAV_SECTIONS)[number];

export type DashboardNavOptions = {
  piggyEnabled?: boolean;
};

/** 사이드바·표시 설정 동기화용 활성 경로 */
export function getActiveAppNavHrefs(
  options: DashboardNavOptions = {}
): Set<string> {
  const piggy = options.piggyEnabled ?? PIGGY_PLAY_ENABLED;
  const hrefs = new Set<string>();
  for (const section of APP_NAV_SECTIONS) {
    if ("requiresPiggy" in section && section.requiresPiggy && !piggy) {
      continue;
    }
    hrefs.add(section.href);
  }
  return hrefs;
}

/** 표시 설정 그룹 pageId — 활성 페이지만 */
export function getVisibleDisplayPageIds(
  options: DashboardNavOptions = {}
): Set<string> {
  const active = getActiveAppNavHrefs(options);
  const ids = new Set<string>(["global"]);
  for (const section of APP_NAV_SECTIONS) {
    if (!active.has(section.href)) continue;
    for (const pageId of section.linkedDisplayPageIds) {
      ids.add(pageId);
    }
  }
  return ids;
}

/** 표시 설정 키 prefix → pageId */
export function displayKeyPageId(key: DisplaySettingKey): string {
  return key.split(".")[0] ?? "global";
}

/** 모니터링 허브 경로 (레거시 /controllers·/alarms 포함) */
export function isMonitoringNavPath(pathname: string): boolean {
  return (
    pathname.startsWith("/farm") ||
    pathname.startsWith("/controllers") ||
    pathname.startsWith("/alarms")
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
