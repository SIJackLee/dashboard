/** UI motion — duration · easing · distance (CSS 변수와 동기) */
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
} as const;

export type MotionDurationKey = keyof typeof motionDuration;
