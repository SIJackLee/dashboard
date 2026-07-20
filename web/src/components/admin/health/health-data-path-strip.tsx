"use client";

import type { MouseEvent } from "react";
import type {
  HealthSnapshot,
  HealthStatus,
  HealthNodeId,
} from "@/lib/admin/health/types";
import { HEALTH_STATUS_LABEL } from "@/lib/admin/health/types";
import {
  domRectToPeekAnchor,
  type HealthDagNodeSelectPayload,
} from "@/lib/admin/health/health-node-peek-content";
import { healthStatusBorderClass } from "@/components/admin/health/health-status-badge";
import { opsControl, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: HealthSnapshot;
  onNodeSelect?: (payload: HealthDagNodeSelectPayload) => void;
  activeDrillId?: string | null;
  /** true면 수집기 서브칩은 이상만 표시(전부 정상이면 숨김). */
  compactCollectors?: boolean;
};

function needsAttention(status: HealthStatus): boolean {
  return status === "warn" || status === "critical" || status === "unknown";
}

function statusDot(status: HealthStatus): string {
  switch (status) {
    case "ok":
      return "bg-emerald-500";
    case "warn":
      return "bg-amber-500";
    case "critical":
      return "bg-red-500";
    case "not_implemented":
      return "bg-sky-500";
    default:
      return "bg-muted-foreground/40";
  }
}

/** 데이터 경로 — A안: 모바일 균등 분배, PC 한 줄·확대. */
export function HealthDataPathStrip({
  snapshot,
  onNodeSelect,
  activeDrillId,
  compactCollectors = false,
}: Props) {
  const select = (nodeId: HealthNodeId, e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onNodeSelect?.({
      drillId: nodeId,
      dagNodeId: nodeId,
      anchor: domRectToPeekAnchor(rect),
    });
  };

  const collectors = compactCollectors
    ? snapshot.collectorSub.filter((n) => needsAttention(n.status))
    : snapshot.collectorSub;

  return (
    <div className="flex flex-col gap-2">
      <div className={opsControl.pathStrip} role="list">
        {snapshot.pipeline.map((node, i) => {
          const active = activeDrillId === node.id;
          const label = node.short || node.label;
          return (
            <div key={node.id} className={opsControl.pathStep} role="listitem">
              {i > 0 ? (
                <span className={opsControl.pathArrow} aria-hidden>
                  →
                </span>
              ) : null}
              <button
                type="button"
                onClick={(e) => select(node.id, e)}
                aria-pressed={active}
                aria-label={`${node.label} · ${HEALTH_STATUS_LABEL[node.status]}`}
                title={`${node.label} · ${HEALTH_STATUS_LABEL[node.status]}`}
                className={cn(
                  opsControl.chip,
                  healthStatusBorderClass(node.status),
                  active && "ring-2 ring-sky-500/40",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full md:size-2.5",
                    statusDot(node.status),
                  )}
                  aria-hidden
                />
                <span className="min-w-0 md:flex-1">
                  <span className={opsTypography.chipLabel}>{label}</span>
                  <span className={opsTypography.chipMeta}>
                    {HEALTH_STATUS_LABEL[node.status]}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {collectors.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 border-t pt-2">
          {collectors.map((node) => {
            const active = activeDrillId === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={(e) => select(node.id, e)}
                aria-pressed={active}
                className={cn(
                  opsControl.chipSub,
                  "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  healthStatusBorderClass(node.status),
                  active && "ring-2 ring-sky-500/40",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    statusDot(node.status),
                  )}
                  aria-hidden
                />
                {node.short || node.label}
              </button>
            );
          })}
        </div>
      ) : compactCollectors && snapshot.collectorSub.length > 0 ? (
        <p className={cn("border-t pt-2", opsTypography.meta)}>
          수집기 전부 정상
        </p>
      ) : null}
    </div>
  );
}
