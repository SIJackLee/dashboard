"use client";

import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, X } from "lucide-react";
import type { BulkLiveProgress } from "@/components/farm/use-bulk-command-pipeline-tracker";
import { cn } from "@/lib/utils";
import { FEEDBACK_Z } from "@/lib/ui/feedback-layers";

type Props = {
  progress: BulkLiveProgress;
  visible: boolean;
  onDismiss: () => void;
};

export function BulkLiveProgressBanner({
  progress,
  visible,
  onDismiss,
}: Props) {
  if (!visible || progress.total === 0 || typeof document === "undefined") {
    return null;
  }

  const { liveDone, total, ackDone, failed, timedOut, allLive, complete } =
    progress;

  const title = allLive
    ? "현장 반영 완료"
    : timedOut
      ? "현장 반영 일부 미확인"
      : "현장 반영 확인 중";

  const detail = [
    `LIVE ${liveDone}/${total}`,
    `ACK ${ackDone}/${total}`,
    failed > 0 ? `실패 ${failed}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "ui-motion-toast fixed bottom-4 left-1/2 flex max-w-[min(100vw-2rem,28rem)] -translate-x-1/2 items-start gap-2.5 rounded-lg border bg-background px-3.5 py-2.5 text-sm shadow-lg",
        allLive && "border-emerald-200/80",
        timedOut && !allLive && "border-amber-200/80",
        !complete && "border-sky-200/70",
      )}
      style={{ zIndex: FEEDBACK_Z.liveBanner }}
      data-mobile-viewport-toast
      data-bulk-live-banner
      data-feedback-layer="live-banner"
    >
      {allLive ? (
        <CheckCircle2
          className="mt-0.5 size-4 shrink-0 text-emerald-600"
          aria-hidden
        />
      ) : (
        <Loader2
          className={cn(
            "mt-0.5 size-4 shrink-0",
            timedOut ? "text-amber-600" : "animate-spin text-sky-600",
          )}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">{title}</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {detail}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="현장 반영 배너 닫기"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>,
    document.body,
  );
}
