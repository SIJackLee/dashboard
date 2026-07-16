"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type CommandPipelineOverlayPhase = "loading" | "success" | "info" | "error";

export type CommandPipelineOverlayState = {
  visible: boolean;
  phase: CommandPipelineOverlayPhase;
  title: string;
  detail?: string;
  /** false — pending/sent 등 진행 중에는 자동 닫힘 없음 */
  autoDismiss?: boolean;
};

type Props = CommandPipelineOverlayState & {
  onDismiss?: () => void;
  autoDismissMs?: number;
};

/** 알람·설정 적용 — 로딩·현장반영 확인 등 (페이드 인/아웃 오버레이) */
export function CommandPipelineOverlay({
  visible,
  phase,
  title,
  detail,
  autoDismiss = true,
  onDismiss,
  autoDismissMs = 2800,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) {
      setShow(false);
      const t = window.setTimeout(() => setMounted(false), 320);
      return () => window.clearTimeout(t);
    }
    setMounted(true);
    const id = window.requestAnimationFrame(() => setShow(true));
    return () => window.cancelAnimationFrame(id);
  }, [visible]);

  useEffect(() => {
    if (!visible || !onDismiss || !autoDismiss || phase === "loading") return;
    const id = window.setTimeout(onDismiss, autoDismissMs);
    return () => window.clearTimeout(id);
  }, [visible, phase, onDismiss, autoDismissMs, autoDismiss, title]);

  if (!mounted || typeof document === "undefined") return null;

  const Icon =
    phase === "loading"
      ? Loader2
      : phase === "success"
        ? CheckCircle2
        : phase === "error"
          ? AlertCircle
          : Info;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-[70] flex items-center justify-center p-4 transition-opacity duration-300 ease-out",
        show ? "opacity-100" : "opacity-0",
      )}
      data-mobile-viewport-overlay
      aria-live="polite"
      role="status"
    >
      <div
        className={cn(
          "max-w-[min(100vw-2rem,22rem)] rounded-xl border bg-background/95 px-5 py-4 text-center shadow-xl ring-1 ring-border/60 backdrop-blur-sm transition-all duration-300 ease-out",
          show ? "translate-y-0 scale-100" : "translate-y-2 scale-95",
          phase === "success" && "border-emerald-200/80",
          phase === "error" && "border-red-200/80",
          phase === "info" && "border-sky-200/60",
        )}
      >
        <Icon
          className={cn(
            "mx-auto mb-2.5 size-8",
            phase === "loading" && "animate-spin text-muted-foreground",
            phase === "success" && "text-emerald-600 dark:text-emerald-400",
            phase === "error" && "text-red-600 dark:text-red-400",
            phase === "info" && "text-sky-600 dark:text-sky-400",
          )}
          aria-hidden
        />
        <p className="text-sm font-semibold leading-snug">{title}</p>
        {detail ? (
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
