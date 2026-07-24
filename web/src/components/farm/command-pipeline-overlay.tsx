"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motionDuration } from "@/lib/ui/motion-tokens";
import { FEEDBACK_Z } from "@/lib/ui/feedback-layers";

export type CommandPipelineOverlayPhase = "loading" | "success" | "info" | "error";

export type CommandPipelineOverlayState = {
  visible: boolean;
  phase: CommandPipelineOverlayPhase;
  title: string;
  detail?: string;
  /** false — pending/sent 등 진행 중에는 자동 닫힘 없음 */
  autoDismiss?: boolean;
  /** 미지정 시 phase별 기본값 (success 더 길게) */
  autoDismissMs?: number;
};

type Props = CommandPipelineOverlayState & {
  onDismiss?: () => void;
};

const DEFAULT_AUTO_DISMISS_MS: Record<CommandPipelineOverlayPhase, number> = {
  loading: 0,
  success: 5200,
  error: 4000,
  info: 3200,
};

/** 알람·설정 적용 — 로딩·현장반영 확인 등 (페이드 인/아웃 오버레이) */
export function CommandPipelineOverlay({
  visible,
  phase,
  title,
  detail,
  autoDismiss = true,
  onDismiss,
  autoDismissMs,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const onDismissRef = useRef(onDismiss);
  const dismissAfterMs =
    autoDismissMs ?? DEFAULT_AUTO_DISMISS_MS[phase] ?? 3200;

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const dismissible = Boolean(onDismiss) && phase !== "loading";

  const handleDismiss = () => {
    if (!dismissible) return;
    onDismissRef.current?.();
  };

  if (!visible) {
    if (show) setShow(false);
  } else if (!mounted) {
    setMounted(true);
  }

  useEffect(() => {
    if (!visible) {
      const t = window.setTimeout(
        () => setMounted(false),
        motionDuration.normal + 20,
      );
      return () => window.clearTimeout(t);
    }
    const id = window.requestAnimationFrame(() => setShow(true));
    return () => window.cancelAnimationFrame(id);
  }, [visible]);

  useEffect(() => {
    if (!visible || !autoDismiss || phase === "loading") return;
    const id = window.setTimeout(() => onDismissRef.current?.(), dismissAfterMs);
    return () => window.clearTimeout(id);
  }, [visible, phase, dismissAfterMs, autoDismiss]);

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
        "ui-motion-command-overlay fixed inset-0 flex items-center justify-center p-4",
        show ? "opacity-100" : "opacity-0",
        dismissible ? "pointer-events-auto cursor-pointer" : "pointer-events-none",
      )}
      style={{ zIndex: FEEDBACK_Z.overlay }}
      data-feedback-layer="overlay"
      data-mobile-viewport-overlay
      aria-live="polite"
      role={dismissible ? "button" : "status"}
      tabIndex={dismissible ? -1 : undefined}
      aria-label={dismissible ? `${title}. 탭하여 닫기` : undefined}
      onClick={dismissible ? handleDismiss : undefined}
      onKeyDown={
        dismissible
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleDismiss();
              }
            }
          : undefined
      }
    >
      <div
        className={cn(
          "ui-motion-command-card max-w-[min(100vw-2rem,22rem)] rounded-xl border bg-background/95 px-5 py-4 text-center shadow-xl ring-1 ring-border/60 backdrop-blur-sm",
          show ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0",
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
        {dismissible ? (
          <p className="mt-2.5 text-[11px] text-muted-foreground/80">탭하여 닫기</p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
