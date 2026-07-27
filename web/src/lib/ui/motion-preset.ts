import { motionIntent, type MotionIntentKey } from "./motion-tokens";
import { motionClass, motionEaseClass, motionDurationClass } from "./motion-classes";

/** UI intent → L2 surface className */
export function motionPresetForIntent(intent: MotionIntentKey): string {
  const spec = motionIntent[intent];
  if (spec.cssSurface) return spec.cssSurface;
  return motionClass[spec.preset];
}

const durationClassForKey = (
  key: (typeof motionIntent)[MotionIntentKey]["duration"],
): string => {
  if (key === "viewCrossfade") return motionDurationClass.view;
  if (key === "instant") return "";
  return motionDurationClass[key as keyof typeof motionDurationClass];
};

/** intent + duration·easing Tailwind utility (portal·transition 조합용) */
export function motionPresetWithDuration(
  intent: MotionIntentKey,
  extra?: string,
): string {
  const spec = motionIntent[intent];
  const base = motionPresetForIntent(intent);
  const dur = durationClassForKey(spec.duration);
  const ease = motionEaseClass[spec.easing];
  return [base, dur, ease, extra].filter(Boolean).join(" ");
}
