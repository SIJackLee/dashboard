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
  const [wasOpen, setWasOpen] = useState(open);
  const shellRef = useRef<HTMLDivElement>(null);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMounted(true);
      setShow(true);
    } else {
      setLatchedChildren(children);
      setShow(false);
    }
  }

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
          {open ? children : latchedChildren}
        </div>
      </div>
    </div>
  );
}
