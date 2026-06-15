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
  try {
    path = new URL(href, "http://nav.local").pathname;
  } catch {
    path = href.split("?")[0] ?? href;
  }

  let message = "페이지 이동 중…";
  if (path === "/alarms") message = "알람 페이지로 이동 중…";
  else if (path === "/controllers") message = "컨트롤러 페이지로 이동 중…";
  else if (path === "/farm") message = "농장 현황으로 이동 중…";
  else if (path === "/settings") message = "설정 페이지로 이동 중…";
  else if (path.startsWith("/admin")) message = "사용자 관리로 이동 중…";
  else if (path === "/play") message = "게임 페이지로 이동 중…";
  else if (path === "/logs") message = "로그 페이지로 이동 중…";

  return { message, sublabel };
}
