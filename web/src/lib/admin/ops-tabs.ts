export type AdminOpsTabId = "system" | "users" | "farms" | "commands";

export const ADMIN_OPS_TABS: ReadonlyArray<{
  id: AdminOpsTabId;
  label: string;
}> = [
  { id: "system", label: "시스템" },
  { id: "users", label: "사용자" },
  { id: "farms", label: "농장 위치" },
  { id: "commands", label: "명령 이력" },
];

export const ADMIN_OPS_BASE_PATH = "/admin/ops";

const TAB_SEGMENT: Record<Exclude<AdminOpsTabId, "system">, string> = {
  users: "users",
  farms: "farms",
  commands: "commands",
};

/** pathname → 탭 (nested route) */
export function parseAdminOpsTabFromPathname(pathname: string): AdminOpsTabId {
  const normalized = pathname.replace(/\/$/, "");
  if (normalized.endsWith("/users")) return "users";
  if (normalized.endsWith("/farms")) return "farms";
  if (normalized.endsWith("/commands")) return "commands";
  return "system";
}

/** 레거시 ?tab= + pathname */
export function parseAdminOpsTab(
  tab: string | null | undefined,
  pathname?: string,
): AdminOpsTabId {
  if (tab === "users" || tab === "farms" || tab === "commands") return tab;
  if (pathname) return parseAdminOpsTabFromPathname(pathname);
  return "system";
}

export function adminOpsPath(tab: AdminOpsTabId = "system"): string {
  if (tab === "system") return ADMIN_OPS_BASE_PATH;
  return `${ADMIN_OPS_BASE_PATH}/${TAB_SEGMENT[tab]}`;
}

/** @deprecated query tab — 레거시 redirect용 */
export function setAdminOpsTabParam(
  params: URLSearchParams,
  tab: AdminOpsTabId,
): void {
  if (tab === "system") params.delete("tab");
  else params.set("tab", tab);
}

export function adminOpsHref(
  tab: AdminOpsTabId = "system",
  params?: URLSearchParams | Record<string, string | undefined | null>,
): string {
  const search = new URLSearchParams();
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => {
      if (value && key !== "tab") search.set(key, value);
    });
  } else if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "tab") search.set(key, value);
    }
  }
  const base = adminOpsPath(tab);
  const q = search.toString();
  return q ? `${base}?${q}` : base;
}
