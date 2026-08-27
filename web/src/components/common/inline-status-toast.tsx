"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { FEEDBACK_Z } from "@/lib/ui/feedback-layers";
import { opsFeedbackTone } from "@/lib/ui/ops-feedback";

export type InlineStatusTone = "ok" | "warn" | "error" | "info";

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
  tone?: InlineStatusTone;
  className?: string;
};

const TONE_CLASS: Record<InlineStatusTone, string> = {
  ok: opsFeedbackTone.ok,
  warn: opsFeedbackTone.warn,
  error: opsFeedbackTone.error,
  info: opsFeedbackTone.info,
};

export function InlineStatusToast({
  message,
  onDismiss,
  durationMs,
  tone = "info",
  className,
}: Props) {
  const dismissMs =
    durationMs ??
    (tone === "error" ? 6500 : tone === "warn" ? 5500 : 4000);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, dismissMs);
    return () => window.clearTimeout(id);
  }, [dismissMs, message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-feedback-layer="toast"
      className={cn(
        "ui-motion-toast fixed bottom-4 left-1/2 max-w-[min(100vw-2rem,28rem)] -translate-x-1/2 rounded-lg border bg-background px-4 py-2.5 text-sm shadow-lg",
        TONE_CLASS[tone],
        className,
      )}
      style={{ zIndex: FEEDBACK_Z.toast }}
      data-mobile-viewport-toast
    >
      {message}
    </div>
  );
}
