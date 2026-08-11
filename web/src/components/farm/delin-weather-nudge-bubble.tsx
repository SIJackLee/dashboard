"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { unpackWeatherNudge } from "@/lib/weather-control/unpack-recommendation";
import type { WeatherNudgeView } from "@/lib/weather-control/weather-nudge-view";
import { dashboardHubSurface, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

const STALE_APPLY_MESSAGE =
  "조건이 바뀌어 권장을 적용할 수 없습니다. 잠시 후 다시 확인해 주세요.";

type Props = {
  nudge: WeatherNudgeView;
  anchorEl: HTMLElement | null;
  canCommand: boolean;
  onDismiss: () => void;
  onApplied?: (commandId: string) => void;
  flipAbove?: boolean;
};

type BubblePos = {
  top: number;
  left: number;
  maxWidth: number;
};

function clampBubblePos(
  anchor: DOMRect,
  bubbleW: number,
  bubbleH: number,
  flipAbove: boolean,
): BubblePos {
  const pad = 8;
  const gap = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxWidth = Math.min(320, vw - pad * 2);

  let left = anchor.left + anchor.width / 2 - bubbleW / 2;
  left = Math.max(pad, Math.min(left, vw - bubbleW - pad));

  let top = flipAbove
    ? anchor.top - bubbleH - gap
    : anchor.bottom + gap;

  if (top + bubbleH > vh - pad) {
    top = anchor.top - bubbleH - gap;
  }
  if (top < pad) {
    top = anchor.bottom + gap;
  }

  return { top, left, maxWidth };
}

export function DelinWeatherNudgeBubble({
  nudge,
  anchorEl,
  canCommand,
  onDismiss,
  onApplied,
  flipAbove = false,
}: Props) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<BubblePos | null>(null);
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const unpacked = unpackWeatherNudge(nudge);

  const layout = useCallback(() => {
    if (!anchorEl || !bubbleRef.current) return;
    const anchor = anchorEl.getBoundingClientRect();
    const bubble = bubbleRef.current.getBoundingClientRect();
    setPos(clampBubblePos(anchor, bubble.width, bubble.height, flipAbove));
  }, [anchorEl, flipAbove]);

  useLayoutEffect(() => {
    layout();
    window.addEventListener("resize", layout);
    window.addEventListener("scroll", layout, true);
    return () => {
      window.removeEventListener("resize", layout);
      window.removeEventListener("scroll", layout, true);
    };
  }, [layout, nudge.id]);

  const dismiss = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/weather-control/dismiss", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nudge.id }),
      });
    } catch {
      // optimistic hide even on failure
    }
    onDismiss();
  }, [busy, nudge.id, onDismiss]);

  const apply = useCallback(async () => {
    if (busy || !canCommand) return;
    setBusy(true);
    setApplyError(null);
    try {
      const res = await fetch("/api/weather-control/approve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nudge.id }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        commandId?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setApplyError(
          json.message ??
            (json.error === "stale_conditions"
              ? STALE_APPLY_MESSAGE
              : "권장 적용에 실패했습니다. 잠시 후 다시 시도해 주세요."),
        );
        return;
      }
      if (json.commandId) {
        onApplied?.(json.commandId);
      }
      onDismiss();
    } catch {
      setApplyError("권장 적용에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }, [busy, canCommand, nudge.id, onApplied, onDismiss]);

  const style =
    pos != null
      ? { top: pos.top, left: pos.left, maxWidth: pos.maxWidth }
      : { visibility: "hidden" as const, maxWidth: 320 };

  return (
    <div
      ref={bubbleRef}
      role="dialog"
      aria-labelledby="delin-weather-nudge-title"
      aria-live="polite"
      data-testid="delin-weather-nudge-bubble"
      className={cn(
        "fixed z-40 w-[min(20rem,calc(100vw-1rem))] rounded-xl border border-primary/25 p-3 shadow-lg",
        dashboardHubSurface.well,
        motionClass.ariaReplyIn,
      )}
      style={style}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p
          id="delin-weather-nudge-title"
          className={cn(
            "min-w-0 text-[length:var(--density-meta)] font-semibold leading-snug text-primary md:text-[length:var(--density-meta-md)]",
          )}
        >
          기상 기반 권장
        </p>
        <button
          type="button"
          aria-label="무시"
          disabled={busy}
          className={cn(
            "shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground",
            motionClass.microInteractive,
          )}
          onClick={() => void dismiss()}
        >
          <X className={dashboardUi.iconSm} strokeWidth={dashboardUi.iconStroke} />
        </button>
      </div>

      <div className="space-y-1.5 text-[length:var(--density-meta)] leading-snug text-foreground md:text-[length:var(--density-meta-md)]">
        <p>{unpacked.headline}</p>
        {unpacked.contextLine ? (
          <p className="text-muted-foreground">{unpacked.contextLine}</p>
        ) : null}
        <p>{unpacked.currentLine}</p>
        <p className="font-medium text-primary">{unpacked.proposedLine}</p>
        <p className="text-muted-foreground">{unpacked.actionLine}</p>
        {applyError ? (
          <p className="text-status-warn" role="alert">
            {applyError}
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canCommand || busy}
          title={canCommand ? undefined : "명령 권한이 필요합니다"}
          className={cn(
            "inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-[length:var(--density-meta)] font-medium text-primary-foreground",
            (!canCommand || busy) && "opacity-50",
            motionClass.microInteractive,
          )}
          onClick={() => void apply()}
        >
          {busy ? "적용 중…" : "적용"}
        </button>
        <button
          type="button"
          disabled={busy}
          className={cn(
            "inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-[length:var(--density-meta)] font-medium text-foreground",
            motionClass.microInteractive,
          )}
          onClick={() => void dismiss()}
        >
          무시
        </button>
      </div>
    </div>
  );
}
