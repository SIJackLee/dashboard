"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CollectorNodeState, PipelineNodeState } from "@/lib/admin/health/types";
import { HEALTH_STATUS_LABEL } from "@/lib/admin/health/types";
import { healthStatusBorderClass } from "@/components/admin/health/health-status-badge";
import { HEALTH_UI } from "@/lib/admin/health/health-ui-labels";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type NodeTarget = {
  id: string;
  short: string;
  label: string;
  status: PipelineNodeState["status"];
  href?: string;
};

type HealthTopologyGraphProps = {
  nodes: PipelineNodeState[];
  downlinkBranch?: CollectorNodeState;
  onNodeSelect?: (nodeId: string) => void;
  compact?: boolean;
};

const NODE_W = 88;
const NODE_H = 72;
const GAP = 28;
const ARROW = 20;

function statusDotClass(status: PipelineNodeState["status"]): string {
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
      return "bg-muted-foreground";
  }
}

function NodeBox({
  node,
  dashed = false,
  onNodeSelect,
}: {
  node: NodeTarget;
  dashed?: boolean;
  onNodeSelect?: (id: string) => void;
}) {
  const boxClass = cn(
    "flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl border-2 bg-card px-1 py-2 transition-colors hover:bg-muted/40",
    healthStatusBorderClass(node.status),
    dashed && "border-dashed"
  );

  const content = (
    <>
      <span className={cn("size-2.5 rounded-full", statusDotClass(node.status))} />
      <span className="text-sm font-semibold">{node.short}</span>
      <span className="text-[10px] text-muted-foreground">
        {HEALTH_STATUS_LABEL[node.status]}
      </span>
    </>
  );

  if (onNodeSelect) {
    return (
      <button
        type="button"
        onClick={() => onNodeSelect(node.id)}
        className={boxClass}
        aria-label={`${node.label} 상세`}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={node.href ?? "#"} className={boxClass}>
      {content}
    </Link>
  );
}

export function HealthTopologyGraph({
  nodes,
  downlinkBranch,
  onNodeSelect,
  compact = false,
}: HealthTopologyGraphProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const main = nodes.filter((n) => n.id !== "external");
  const external = nodes.find((n) => n.id === "external");
  const collectorIdx = main.findIndex((n) => n.id === "collector");

  const mainWidth =
    main.length * NODE_W + Math.max(0, main.length - 1) * (GAP + ARROW);
  const svgW = Math.max(mainWidth, 320);
  const branchY = compact ? NODE_H + 20 : NODE_H + 32;
  const svgH = downlinkBranch ? branchY + NODE_H + 8 : NODE_H + 8;

  if (!mounted) {
    return (
      <div className="space-y-3">
        <p className={cn(dashboardTypography.meta)}>
          정점 색=상태 · 클릭=상세
          {downlinkBranch ? ` · ${HEALTH_UI.downlink} 별도` : ""}
        </p>
        <div
          className="h-24 animate-pulse rounded-xl border bg-muted/20"
          aria-busy="true"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className={cn(dashboardTypography.meta)}>
        정점 색=상태 · 클릭=상세
        {downlinkBranch ? ` · ${HEALTH_UI.downlink} 별도` : ""}
      </p>
      <div className="overflow-x-auto rounded-xl border bg-muted/10 p-3">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="min-w-full"
          role="img"
          aria-label="데이터 경로 토폴로지"
        >
          {main.map((node, i) => {
            const x = i * (NODE_W + GAP + ARROW);
            const nx = x + NODE_W + 4;
            return (
              <g key={node.id}>
                <foreignObject x={x} y={0} width={NODE_W} height={NODE_H}>
                  <NodeBox node={node} onNodeSelect={onNodeSelect} />
                </foreignObject>
                {i < main.length - 1 ? (
                  <>
                    <line
                      x1={nx}
                      y1={NODE_H / 2}
                      x2={nx + ARROW - 8}
                      y2={NODE_H / 2}
                      stroke="currentColor"
                      className="text-muted-foreground"
                      strokeWidth={2}
                    />
                    <polygon
                      points={`${nx + ARROW - 8},${NODE_H / 2 - 4} ${nx + ARROW},${NODE_H / 2} ${nx + ARROW - 8},${NODE_H / 2 + 4}`}
                      className="fill-muted-foreground"
                    />
                  </>
                ) : null}
              </g>
            );
          })}

          {downlinkBranch ? (
            <g>
              <line
                x1={
                  collectorIdx >= 0
                    ? collectorIdx * (NODE_W + GAP + ARROW) + NODE_W / 2
                    : NODE_W / 2
                }
                y1={NODE_H}
                x2={
                  collectorIdx >= 0
                    ? collectorIdx * (NODE_W + GAP + ARROW) + NODE_W / 2
                    : NODE_W / 2
                }
                y2={branchY - 4}
                stroke="currentColor"
                strokeDasharray="4 3"
                className="text-muted-foreground"
              />
              <foreignObject
                x={
                  collectorIdx >= 0
                    ? collectorIdx * (NODE_W + GAP + ARROW)
                    : 0
                }
                y={branchY}
                width={NODE_W}
                height={NODE_H}
              >
                <NodeBox
                  node={{
                    id: downlinkBranch.id,
                    short: downlinkBranch.short,
                    label: downlinkBranch.label,
                    status: downlinkBranch.status,
                  }}
                  dashed
                  onNodeSelect={onNodeSelect}
                />
              </foreignObject>
            </g>
          ) : null}
        </svg>
      </div>
      {downlinkBranch ? (
        <p className={dashboardTypography.meta}>
          {HEALTH_UI.downlink} · {HEALTH_UI.downlinkDesc}
        </p>
      ) : null}
      {external ? (
        <p className={dashboardTypography.meta}>
          {HEALTH_UI.externalLink} · {HEALTH_UI.externalDesc}
        </p>
      ) : null}
    </div>
  );
}
