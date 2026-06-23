export type MobileHubTabId = "map" | "list" | "ctrl";

export const MOBILE_HUB_TABS: { id: MobileHubTabId; label: string }[] = [
  { id: "map", label: "지도" },
  { id: "list", label: "목록" },
  { id: "ctrl", label: "제어" },
];

export function parseMobileHubTab(
  value: string | null | undefined
): MobileHubTabId {
  if (value === "map" || value === "ctrl") return value;
  return "list";
}

export function setMobileHubTabParam(
  params: URLSearchParams,
  tab: MobileHubTabId
): void {
  if (tab === "list") params.delete("hub");
  else params.set("hub", tab);
}
