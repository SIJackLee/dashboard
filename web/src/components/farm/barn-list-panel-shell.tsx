"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BarnListPanelKind = "graph" | "settings" | "motor";

type Props = {
  open: boolean;
  panelKind: BarnListPanelKind;
  children: ReactNode;
  className?: string;
};

/** 축사 목록 — 그래프 / 설정 / 모터그래프 패널 expand·collapse (hybrid motion) */
export function BarnListPanelShell({
  open,
  panelKind,
  children,
  className,
}: Props) {
  const [mounted, setMounted] = useState(open);
  const [show, setShow] = useState(open);
  const [latchedChildren, setLatchedChildren] = useState<ReactNode>(children);
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setLatchedChildren(children);
    }
  }, [open, children]);

  useEffect(() => {
    if (!open) {
      setShow(false);
      return;
    }
    // 즉시 마운트·표시 — 예전 double-rAF + 320ms fallback은 체감 지연만 키움
    setMounted(true);
    setShow(true);
  }, [open]);

  useEffect(() => {
    const el = shellRef.current;
    if (!el || show || !mounted) return;

    const onEnd = (e: TransitionEvent) => {
      if (e.target !== el || e.propertyName !== "grid-template-rows") return;
      setMounted(false);
    };
    el.addEventListener("transitionend", onEnd);
    const fallback = window.setTimeout(() => setMounted(false), 400);
    return () => {
      el.removeEventListener("transitionend", onEnd);
      window.clearTimeout(fallback);
    };
  }, [show, mounted]);

  if (!mounted) return null;

  return (
    <div
      ref={shellRef}
      className={cn(
        "barn-list-panel-shell",
        panelKind === "settings" && "barn-list-panel-shell--settings",
        panelKind === "motor" && "barn-list-panel-shell--motor",
        className
      )}
      data-open={show}
      aria-hidden={!show}
    >
      <div className="barn-list-panel-inner min-h-0">
        <div
          className="barn-list-panel-content min-h-0"
          data-state={show ? "open" : "closed"}
          data-panel={panelKind}
        >
          {latchedChildren}
        </div>
      </div>
    </div>
  );
}
