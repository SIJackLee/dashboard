/**
 * L2 motion presets — Tailwind utility + globals.css surface class 조합.
 * 의도 매핑: `motionIntent` · 문서: `docs/UI_MOTION.md`
 *
 * 사용 예:
 *   className={cn(motionClass.microInteractive, motionClass.easeStandard)}
 *   className={motionClass.enterFade}
 *   className={cn(motionClass.portalEnter, motionClass.durationNormal)}
 */

/** Tailwind `duration-motion-*` — @theme 과 매칭 */
export const motionDurationClass = {
  fast: "duration-motion-fast",
  normal: "duration-motion-normal",
  moderate: "duration-motion-moderate",
  emphasis: "duration-motion-emphasis",
  exit: "duration-motion-exit",
  view: "duration-motion-view",
} as const;

/** CSS 변수 easing — Tailwind arbitrary */
export const motionEaseClass = {
  standard: "ease-[var(--motion-ease-standard)]",
  enter: "ease-[var(--motion-ease-enter)]",
  exit: "ease-[var(--motion-ease-exit)]",
  emphasis: "ease-[var(--motion-ease-emphasis)]",
} as const;

export const motionClass = {
  ...motionDurationClass,

  // 하위 호환 alias
  durationFast: motionDurationClass.fast,
  durationNormal: motionDurationClass.normal,
  durationModerate: motionDurationClass.moderate,
  durationEmphasis: motionDurationClass.emphasis,
  durationExit: motionDurationClass.exit,
  durationView: motionDurationClass.view,

  ...motionEaseClass,
  easeStandard: motionEaseClass.standard,
  easeEnter: motionEaseClass.enter,
  easeExit: motionEaseClass.exit,
  easeEmphasis: motionEaseClass.emphasis,

  /** Micro — hover·focus·chip (120ms, colors/opacity only) */
  microInteractive:
    "transition-[color,background-color,border-color,opacity,box-shadow] duration-motion-fast ease-[var(--motion-ease-standard)]",
  microHover: "transition-colors duration-motion-fast ease-[var(--motion-ease-standard)]",

  /** Surface — 카드·행 하이라이트 */
  surfaceRing:
    "transition-[box-shadow,opacity] duration-motion-normal ease-[var(--motion-ease-standard)]",

  /** Enter — globals.css keyframe surfaces */
  enterFade: "ui-motion-enter-fade",
  enterSlideUp: "ui-motion-enter-slide-up",
  enterModalBackdrop: "ui-motion-modal-backdrop",
  enterModalPanel: "ui-motion-modal-panel",
  enterToast: "ui-motion-toast",
  enterNavOverlay: "ui-motion-nav-overlay",

  /** Exit */
  exitFade: "ui-motion-exit-fade",

  /** Layout — grid-rows expand, chevron */
  panelExpand: "ui-motion-panel-expand",
  panelExpandInner: "ui-motion-panel-expand-inner",
  collapsibleExpand: "settings-collapsible-body",
  collapsibleInner: "settings-collapsible-body-inner",
  chevronRotate: "settings-collapsible-chevron",

  /** Stagger — 목록·카드 순차 등장 */
  staggerIn: "ui-motion-stagger-in",

  /** Emphasis — 확대 상세 morph */
  emphasisMorph: "farm-heat-morph",

  /** 그리드 상세 — 컨트롤러 좌/우 전환 */
  detailSlideNext: "farm-detail-slide-next",
  detailSlidePrev: "farm-detail-slide-prev",

  /** Command pipeline / soft refresh (기존 surfaces) */
  commandOverlay: "ui-motion-command-overlay",
  commandCard: "ui-motion-command-card",
  softRefreshBar: "ui-motion-soft-refresh-bar",

  /** shadcn portal — fade + zoom */
  portalEnter:
    "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
  portalOverlayEnter:
    "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",

  /** bottom sheet — slide from bottom */
  sheetEnter:
    "data-open:slide-in-from-bottom data-closed:slide-out-to-bottom",

  /** 속성별 transition (transition-all 금지 대체) */
  transitionColors: "transition-colors",
  transitionOpacity: "transition-opacity",
  transitionTransform: "transition-transform",
  transitionLayout:
    "transition-[grid-template-rows,opacity,transform] duration-motion-moderate ease-[var(--motion-ease-standard)]",

  /** map ↔ list 패널 */
  viewCrossfade: "transition-opacity duration-motion-view ease-out",
} as const;

export type MotionClassKey = keyof typeof motionClass;
