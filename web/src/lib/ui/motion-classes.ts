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

  /** 차트 탭 — 통합 추이 advanced motion */
  farmChartPlotReveal: "farm-chart-plot-reveal",
  farmChartEnvelopeIn: "farm-chart-envelope-in",
  farmChartLineSoftIn: "farm-chart-line-soft-in",
  farmChartMarkerPop: "farm-chart-marker-pop",
  farmChartBrushWindow: "farm-chart-brush-window",
  farmChartBrushBar: "farm-chart-brush-bar",
  farmChartScopeShell: "farm-chart-scope-shell",
  farmChartPanelShell: "farm-chart-panel-shell",
  farmChartTipIn: "farm-chart-tip-in",
  farmChartTipHero: "farm-chart-tip-hero",
  farmChartAlarmPin: "farm-chart-alarm-pin",
  farmChartChannelBar: "farm-chart-channel-bar",
  farmChartHoverRing: "farm-chart-hover-ring",
  farmChartLineGlow: "farm-chart-line-glow",
  farmChartReflow: "farm-chart-reflow",
  farmChartBandGuideIn: "farm-chart-band-guide-in",
  farmChartLayersEnter: "farm-chart-layers-enter",
  farmChartLayersExit: "farm-chart-layers-exit",
  /** 레이어 툴바 — 그룹/하위 아이콘 stagger */
  farmChartLayerIconEnter: "farm-chart-layer-icon-enter",
  farmChartLayerIconExit: "farm-chart-layer-icon-exit",
  farmChartLayerFlyoutEnter: "farm-chart-layer-flyout-enter",
  farmChartLayerFlyoutExit: "farm-chart-layer-flyout-exit",
  farmChartLayerFlyoutItemEnter: "farm-chart-layer-flyout-item-enter",
  farmChartLayerFlyoutItemExit: "farm-chart-layer-flyout-item-exit",
  /** 루트 → 세로 그룹 패널 */
  farmChartLayerColumnEnter: "farm-chart-layer-column-enter",
  farmChartLayerColumnExit: "farm-chart-layer-column-exit",
  /** 그룹 → 왼쪽(RTL) 하위 플라이아웃 */
  farmChartLayerFlyoutRtlEnter: "farm-chart-layer-flyout-rtl-enter",
  farmChartLayerFlyoutRtlExit: "farm-chart-layer-flyout-rtl-exit",
  farmChartLayerFlyoutRtlItemEnter: "farm-chart-layer-flyout-rtl-item-enter",
  farmChartLayerFlyoutRtlItemExit: "farm-chart-layer-flyout-rtl-item-exit",
  farmChartLayerBadgePop: "farm-chart-layer-badge-pop",
  farmChartClipWipeIn: "farm-chart-clip-wipe-in",
  farmChartClipWipeOut: "farm-chart-clip-wipe-out",
  farmChartScopeZoomIn: "farm-chart-scope-zoom-in",
  farmChartScopeZoomOut: "farm-chart-scope-zoom-out",
  farmChartScopeChipIn: "farm-chart-scope-chip-in",
  farmChartScopeHandlePulse: "farm-chart-scope-handle-pulse",

  /** ARIA 오브 (P1) */
  ariaOrbRings: "aria-orb-rings",
  ariaOrbBreathe: "aria-orb-breathe",
  ariaOrbPulseListen: "aria-orb-pulse-listen",
  ariaOrbPulseSpeak: "aria-orb-pulse-speak",
  ariaOrbSpin: "aria-orb-spin",
  ariaOrbStatic: "aria-orb-static",
  ariaOrbCore: "aria-orb-core",
  ariaOrbCoreListen: "aria-orb-core-listen",
  ariaOrbCoreSpeak: "aria-orb-core-speak",
  ariaOrbBreatheAlt: "aria-orb-breathe-alt",
  ariaOrbBreatheLag: "aria-orb-breathe-lag",
  ariaOrbListenAmbient: "aria-orb-listen-ambient",
  ariaOrbHero: "aria-orb-hero",
  ariaDockIn: "aria-dock-in",
  /** 응답·상태 메시지 등장 */
  ariaReplyIn: "ui-motion-enter-fade",
  ariaPanelIn: "ui-motion-enter-slide-up",

  /** 헤더 도구 패널 — 버튼 왼쪽 슬라이드 */
  headerToolsPanel: "header-tools-panel",

  /** 통합 FAB 일자 레일 — 펼침/접힘 */
  hubWidgetRail: "hub-widget-rail",
  hubWidgetRailItemEnter: "hub-widget-rail-item-enter",
  hubWidgetRailItemExit: "hub-widget-rail-item-exit",
  /** 통합 FAB 3방향 원형 방사 */
  hubWidgetOrbitItemEnter: "hub-widget-orbit-item-enter",
  hubWidgetOrbitItemExit: "hub-widget-orbit-item-exit",
  hubWidgetDetailIn: "hub-widget-detail-in",

  /** 그리드 상세 — 컨트롤러 캐러셀 enter/exit */
  detailCarousel: "farm-detail-carousel",
  detailCarouselLayer: "farm-detail-carousel-layer",
  detailSlideEnterNext: "farm-detail-slide-enter-next",
  detailSlideEnterPrev: "farm-detail-slide-enter-prev",
  detailSlideExitNext: "farm-detail-slide-exit-next",
  detailSlideExitPrev: "farm-detail-slide-exit-prev",
  /** @deprecated enter-next/prev 별칭 — 캐러셀 전환 권장 */
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

  /** @deprecated map/list/chart — viewSlide* 사용 */
  viewCrossfade: "transition-opacity duration-motion-view ease-out",

  /** 농장 보기 탭 패널 슬라이드 (그리드↔목록↔차트) */
  viewSlideEnterNext: "farm-view-slide-enter-next",
  viewSlideEnterPrev: "farm-view-slide-enter-prev",
  viewSlideExitNext: "farm-view-slide-exit-next",
  viewSlideExitPrev: "farm-view-slide-exit-prev",
  viewTabPill: "farm-view-tab-pill",
} as const;

export type MotionClassKey = keyof typeof motionClass;
