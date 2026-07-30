/**
 * UI density — comfortable(기본, md≈2×) / compact(PC 조밀).
 * CSS: globals.css `--density-*` · html[data-density]
 * @see docs/UI_DENSITY.md
 */

export const DENSITY_STORAGE_KEY = "dashboard-density";

export type UiDensity = "comfortable" | "compact";

export function isUiDensity(v: unknown): v is UiDensity {
  return v === "comfortable" || v === "compact";
}

export function readDensityFromDom(): UiDensity {
  if (typeof document === "undefined") return "comfortable";
  const raw = document.documentElement.dataset.density;
  return isUiDensity(raw) ? raw : "comfortable";
}

export function applyDensity(mode: UiDensity) {
  document.documentElement.dataset.density = mode;
  localStorage.setItem(DENSITY_STORAGE_KEY, mode);
}

export function nextDensity(mode: UiDensity): UiDensity {
  return mode === "comfortable" ? "compact" : "comfortable";
}

/**
 * Tailwind arbitrary — `--density-*` 직접 참조.
 * 인라인 comfortable 본문 rem 리터럴 금지 (verify:ui-density).
 */
export const densityClass = {
  body: "text-[length:var(--density-body)]",
  bodyMd: "text-[length:var(--density-body-md)]",
  meta: "text-[length:var(--density-meta)]",
  metaMd: "text-[length:var(--density-meta-md)]",
  metaToMd:
    "text-[length:var(--density-meta)] md:text-[length:var(--density-meta-md)]",
  bodyToMd:
    "text-[length:var(--density-body)] md:text-[length:var(--density-body-md)]",
  controlText: "text-[length:var(--density-control-text)]",
  controlTextMd: "text-[length:var(--density-control-text-md)]",
  controlTextToMd:
    "text-[length:var(--density-control-text)] md:text-[length:var(--density-control-text-md)]",
  controlHMd:
    "h-[length:var(--density-control-h-md)] min-h-[length:var(--density-control-h-md)]",
  /** bulk 모달 등 sm → lg 확대 */
  metaToLgBodyMd:
    "text-[length:var(--density-meta)] leading-snug md:text-[length:var(--density-body)] md:leading-snug lg:text-[length:var(--density-body-md)] lg:leading-snug",
  metaToLgOnly:
    "text-[length:var(--density-meta)] leading-snug lg:text-[length:var(--density-body-md)]",
} as const;
