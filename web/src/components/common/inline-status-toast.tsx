"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

export type InlineStatusTone = "ok" | "warn" | "error" | "info";

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
  tone?: InlineStatusTone;
  className?: string;
};

const TONE_CLASS: Record<InlineStatusTone, string> = {
  ok: "border-emerald-200/80 text-emerald-900 dark:border-emerald-900/50 dark:text-emerald-100",
  warn: "border-amber-200/80 text-amber-950 dark:border-amber-900/50 dark:text-amber-100",
  error: "border-red-200/80 text-red-900 dark:border-red-900/50 dark:text-red-100",
  info: "border-border text-foreground",
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
      className={cn(
        "ui-motion-toast fixed bottom-4 left-1/2 z-[60] max-w-[min(100vw-2rem,28rem)] -translate-x-1/2 rounded-lg border bg-background px-4 py-2.5 text-sm shadow-lg",
        TONE_CLASS[tone],
        className,
      )}
      data-mobile-viewport-toast
    >
      {message}
    </div>
  );
}
