"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HealthStatusBadge } from "@/components/admin/health/health-status-badge";
import { Button } from "@/components/ui/button";
import {
  buildNodePeekContent,
  type PeekAnchor,
} from "@/lib/admin/health/health-node-peek-content";
import type { HealthNodeId, HealthSnapshot } from "@/lib/admin/health/types";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const PEEK_WIDTH = 240;
const PEEK_EST_HEIGHT = 200;

type Props = {
  nodeId: HealthNodeId;
  anchor: PeekAnchor;
  snapshot: HealthSnapshot;
  onOpenDetail: () => void;
  onClose: () => void;
};

function computePosition(anchor: PeekAnchor): { top: number; left: number } {
  const margin = 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 800;
  const vh = typeof window !== "undefined" ? window.innerHeight : 600;

  let left = anchor.left + anchor.width / 2 - PEEK_WIDTH / 2;
  left = Math.max(margin, Math.min(left, vw - PEEK_WIDTH - margin));

  let top = anchor.top + anchor.height + margin;
  if (top + PEEK_EST_HEIGHT > vh - margin) {
    top = Math.max(margin, anchor.top - margin - PEEK_EST_HEIGHT);
  }

  return { top, left };
}

export function HealthNodePeekPopover({
  nodeId,
  anchor,
  snapshot,
  onOpenDetail,
  onClose,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(() => computePosition(anchor));
  const content = buildNodePeekContent(nodeId, snapshot);

  useLayoutEffect(() => {
    setPosition(computePosition(anchor));
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (cardRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScroll = () => onClose();

    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onPointerDown, true);
    }, 0);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`${content.title} 요약`}
      className="fixed z-40 w-[240px] rounded-xl border border-border bg-popover p-3 text-popover-foreground ring-1 ring-foreground/10"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={cn(dashboardTypography.sectionTitle, "truncate text-sm")}>
            {content.title}
          </p>
          <p className={cn(dashboardTypography.meta, "truncate")}>{nodeId}</p>
        </div>
        <HealthStatusBadge status={content.status} className="shrink-0 text-xs" />
      </div>

      <ul className={cn("mt-3 space-y-1.5", dashboardTypography.meta)}>
        {content.kpis.map((kpi, i) => (
          <li key={i} className="truncate">
            {kpi}
          </li>
        ))}
      </ul>

      {content.d11Line ? (
        <p className={cn("mt-2 truncate text-xs text-amber-800 dark:text-amber-400")}>
          D11: {content.d11Line}
        </p>
      ) : null}

      <Button type="button" onClick={onOpenDetail} className="mt-3 w-full" size="sm">
        상세 보기
      </Button>
    </div>,
    document.body
  );
}
