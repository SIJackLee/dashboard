"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

type Props = {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
  className?: string;
};

export function InlineStatusToast({
  message,
  onDismiss,
  durationMs = 4000,
  className,
}: Props) {
  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [durationMs, message, onDismiss]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "ui-motion-toast fixed bottom-4 left-1/2 z-[60] max-w-[min(100vw-2rem,28rem)] -translate-x-1/2 rounded-lg border bg-background px-4 py-2.5 text-sm shadow-lg",
        className,
      )}
      data-mobile-viewport-toast
    >
      {message}
    </div>
  );
}
