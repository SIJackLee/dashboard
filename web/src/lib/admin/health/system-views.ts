export type HealthSystemViewId = "overview" | "collect" | "field" | "platform";

export const HEALTH_SYSTEM_VIEWS: ReadonlyArray<{
  id: HealthSystemViewId;
  label: string;
}> = [
  { id: "overview", label: "개요" },
  { id: "collect", label: "수집" },
  { id: "field", label: "현장" },
  { id: "platform", label: "플랫폼" },
];

export function parseHealthSystemView(
  view: string | null | undefined
): HealthSystemViewId {
  if (view === "collect" || view === "field" || view === "platform") return view;
  return "overview";
}

export function setHealthSystemViewParam(
  params: URLSearchParams,
  view: HealthSystemViewId
): void {
  if (view === "overview") params.delete("view");
  else params.set("view", view);
}
