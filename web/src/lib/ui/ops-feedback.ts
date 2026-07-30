/**
 * 운영 피드백 톤 — 명령/토스트/배너 공통 (H4).
 * @see docs/UI_FEEDBACK.md
 */

export type OpsFeedbackTone = "ok" | "warn" | "error" | "info" | "loading";

/** 면·테두리 — elevation float 위 채도 (데이터/알람급) */
export const opsFeedbackTone = {
  ok: "border-[color-mix(in_oklch,var(--status-ok)_35%,var(--border))] text-[var(--status-ok)]",
  warn: "border-[color-mix(in_oklch,var(--status-warn)_45%,var(--border))] text-[var(--status-warn)]",
  error:
    "border-[color-mix(in_oklch,var(--status-danger)_40%,var(--border))] text-[var(--status-danger)]",
  info: "border-border text-foreground",
  loading: "border-border text-muted-foreground",
} as const;

export const opsFeedbackIcon = {
  ok: "text-[var(--status-ok)]",
  warn: "text-[var(--status-warn)]",
  error: "text-[var(--status-danger)]",
  info: "text-channel-info",
  loading: "animate-spin text-muted-foreground",
} as const;

/** 플로팅 셸 — elevation float + 토스트 모션 */
export const opsFeedbackShell =
  "rounded-lg border bg-background px-4 py-2.5 text-sm shadow-lg";

export function feedbackToneFromPipeline(
  phase: "loading" | "success" | "info" | "error",
): OpsFeedbackTone {
  if (phase === "success") return "ok";
  if (phase === "error") return "error";
  if (phase === "loading") return "loading";
  return "info";
}
