/**
 * UI motion — duration · easing · distance
 * CSS `:root` 변수(`globals.css`) 및 Tailwind `@theme --duration-motion-*`와 동기 유지.
 * 검증: `npm run verify:motion-tokens`
 */

export const motionDuration = {
  instant: 0,
  fast: 120,
  normal: 200,
  moderate: 280,
  emphasis: 360,
  exit: 150,
  viewCrossfade: 150,
} as const;

export const motionEasing = {
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  enter: "cubic-bezier(0, 0, 0.2, 1)",
  exit: "cubic-bezier(0.4, 0, 1, 1)",
  emphasis: "cubic-bezier(0.2, 0.8, 0.2, 1)",
} as const;

export const motionDistance = {
  sm: 4,
  md: 8,
  lg: 16,
  /** 캐러셀 슬라이드 — CSS `%` (`--motion-distance-slide`), px 아님 */
  slidePercent: 28,
} as const;

/** 목록·카드 stagger 간격(ms) — PC·모바일 동일 리듬 */
export const motionStaggerStepMs = 40;

/** CSS custom property 이름 — JS·문서·검증 스크립트 공용 */
export const motionCssVar = {
  duration: {
    fast: "--motion-duration-fast",
    normal: "--motion-duration-normal",
    moderate: "--motion-duration-moderate",
    emphasis: "--motion-duration-emphasis",
    exit: "--motion-duration-exit",
    view: "--motion-duration-view",
  },
  tailwindDuration: {
    fast: "--duration-motion-fast",
    normal: "--duration-motion-normal",
    moderate: "--duration-motion-moderate",
    emphasis: "--duration-motion-emphasis",
    exit: "--duration-motion-exit",
    view: "--duration-motion-view",
  },
  easing: {
    standard: "--motion-ease-standard",
    enter: "--motion-ease-enter",
    exit: "--motion-ease-exit",
    emphasis: "--motion-ease-emphasis",
  },
  distance: {
    sm: "--motion-distance-sm",
    md: "--motion-distance-md",
    lg: "--motion-distance-lg",
  },
} as const;

export type MotionDurationKey = keyof typeof motionDuration;
export type MotionEasingKey = keyof typeof motionEasing;
export type MotionIntentKey =
  | "micro"
  | "surface"
  | "enter"
  | "exit"
  | "layout"
  | "emphasis"
  | "view";

/** L2 preset 키 — `motionClass`와 1:1 */
export type MotionPresetKey =
  | "microInteractive"
  | "surfaceRing"
  | "enterFade"
  | "exitFade"
  | "panelExpand"
  | "emphasisMorph"
  | "viewCrossfade";

/**
 * UI 의도 → 토큰·L2 프리셋(`motionClass`) 매핑.
 * 컴포넌트는 intent에 맞는 preset만 조합 — 임의 duration/easing 금지.
 */
export const motionIntent: Record<
  MotionIntentKey,
  {
    duration: MotionDurationKey;
    easing: MotionEasingKey;
    preset: MotionPresetKey;
    cssSurface?: string;
  }
> = {
  micro: {
    duration: "fast",
    easing: "standard",
    preset: "microInteractive",
  },
  surface: {
    duration: "normal",
    easing: "standard",
    preset: "surfaceRing",
  },
  enter: {
    duration: "normal",
    easing: "enter",
    preset: "enterFade",
    cssSurface: "ui-motion-enter-fade",
  },
  exit: {
    duration: "exit",
    easing: "exit",
    preset: "exitFade",
    cssSurface: "ui-motion-exit-fade",
  },
  layout: {
    duration: "moderate",
    easing: "standard",
    preset: "panelExpand",
    cssSurface: "ui-motion-panel-expand",
  },
  emphasis: {
    duration: "emphasis",
    easing: "emphasis",
    preset: "emphasisMorph",
    cssSurface: "farm-heat-morph",
  },
  view: {
    duration: "viewCrossfade",
    easing: "standard",
    preset: "viewCrossfade",
  },
};
