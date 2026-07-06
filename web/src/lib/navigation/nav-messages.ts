import { sublabelFromHref } from "@/lib/navigation/nav-utils";

export type NavMessageOptions = {
  message?: string;
  sublabel?: string;
};

export function resolveNavMessage(
  href: string,
  overrides?: NavMessageOptions
): { message: string; sublabel?: string } {
  const sublabel = overrides?.sublabel ?? sublabelFromHref(href);

  if (overrides?.message) {
    return { message: overrides.message, sublabel };
  }

  let path = href;
  let tab: string | null = null;
  let opsTab: string | null = null;
  try {
    const url = new URL(href, "http://nav.local");
    path = url.pathname;
    tab = url.searchParams.get("tab");
    if (path.startsWith("/admin")) {
      opsTab = url.searchParams.get("tab");
    }
  } catch {
    path = href.split("?")[0] ?? href;
  }

  let message = "페이지 이동 중…";
  if (path === "/alarms" || tab === "alarms" || tab === "ops") {
    message = "컨트롤러 탭으로 이동 중…";
  } else if (path === "/controllers" || tab === "devices") {
    message = "컨트롤러 탭으로 이동 중…";
  } else if (path === "/farm") message = "모니터링으로 이동 중…";
  else if (path === "/admin/ops" || path.startsWith("/admin/ops/") || path.startsWith("/admin/health") || path.startsWith("/admin/users")) {
    if (path.endsWith("/users") || opsTab === "users") message = "운영 · 사용자 탭으로 이동 중…";
    else if (path.endsWith("/farms") || opsTab === "farms") message = "운영 · 농장 위치 탭으로 이동 중…";
    else if (path.endsWith("/commands") || opsTab === "commands") message = "운영 · 명령 이력 탭으로 이동 중…";
    else message = "운영 · 시스템 탭으로 이동 중…";
  } else if (path === "/settings") message = "페이지 이동 중…";
  else if (path.startsWith("/admin/health")) message = "시스템 상태로 이동 중…";
  else if (path.startsWith("/admin/users")) message = "사용자 관리로 이동 중…";
  else if (path.startsWith("/admin")) message = "관리 페이지로 이동 중…";
  else if (path === "/play") message = "모니터링으로 이동 중…";

  return { message, sublabel };
}
