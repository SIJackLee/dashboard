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
  const openRef = useRef(open);
  openRef.current = open;

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

    setMounted(true);
    let outer = 0;
    let inner = 0;
    let cancelled = false;

    const reveal = () => {
      if (!cancelled && openRef.current) setShow(true);
    };

    outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(reveal);
    });
    const fallback = window.setTimeout(reveal, 320);

    return () => {
      cancelled = true;
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.clearTimeout(fallback);
    };
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
