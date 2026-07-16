/** Tailwind duration utilities — @theme --duration-motion-* 와 매칭 */
export const motionClass = {
  durationFast: "duration-motion-fast",
  durationNormal: "duration-motion-normal",
  durationModerate: "duration-motion-moderate",
  durationEmphasis: "duration-motion-emphasis",
  durationExit: "duration-motion-exit",
  durationView: "duration-motion-view",
  /** shadcn portal — fade + zoom */
  portalEnter:
    "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
  portalOverlayEnter:
    "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
  /** bottom sheet — slide from bottom */
  sheetEnter:
    "data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",
  transitionColors: "transition-colors",
  transitionOpacity: "transition-opacity",
  transitionTransform: "transition-transform",
  viewCrossfade: "transition-opacity duration-motion-view ease-out",
} as const;
