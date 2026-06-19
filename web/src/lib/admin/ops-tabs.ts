export type AdminOpsTabId = "system" | "users" | "farms" | "display" | "commands";

export const ADMIN_OPS_TABS: ReadonlyArray<{
  id: AdminOpsTabId;
  label: string;
}> = [
  { id: "system", label: "시스템" },
  { id: "users", label: "사용자" },
  { id: "farms", label: "농장 메타" },
  { id: "display", label: "표시" },
  { id: "commands", label: "명령 이력" },
];

export const ADMIN_OPS_BASE_PATH = "/admin/ops";

export function parseAdminOpsTab(
  tab: string | null | undefined
): AdminOpsTabId {
  if (tab === "users" || tab === "farms" || tab === "display" || tab === "commands")
    return tab;
  return "system";
}

export function setAdminOpsTabParam(
  params: URLSearchParams,
  tab: AdminOpsTabId
): void {
  if (tab === "system") params.delete("tab");
  else params.set("tab", tab);
}

export function adminOpsHref(
  tab: AdminOpsTabId = "system",
  params?: URLSearchParams | Record<string, string | undefined | null>
): string {
  const search = new URLSearchParams();
  if (params instanceof URLSearchParams) {
    params.forEach((value, key) => {
      if (value) search.set(key, value);
    });
  } else if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
  }
  setAdminOpsTabParam(search, tab);
  const q = search.toString();
  return q ? `${ADMIN_OPS_BASE_PATH}?${q}` : ADMIN_OPS_BASE_PATH;
}
