import type { DagEdgeLane } from "@/lib/admin/health/build-health-dag";
import type { DAGLayoutNode } from "@/lib/admin/health/dag-layout";

export type Point = { x: number; y: number };

export type RoutedEdge = {
  pathD: string;
  points: Point[];
};

/** foreignObject 내부 button p-1 패딩 — 선이 카드 테두리에 맞닿도록 */
export const DAG_NODE_VISUAL_INSET = 4;

type Side = "left" | "right" | "top" | "bottom";

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function nodeAnchor(
  node: DAGLayoutNode,
  side: Side,
  inset = DAG_NODE_VISUAL_INSET
): Point {
  const { x, y, width: w, height: h } = node;
  switch (side) {
    case "left":
      return { x: x + inset, y: y + h / 2 };
    case "right":
      return { x: x + w - inset, y: y + h / 2 };
    case "top":
      return { x: x + w / 2, y: y + inset };
    case "bottom":
      return { x: x + w / 2, y: y + h - inset };
  }
}

function pointsToPath(points: Point[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${round(p.x)} ${round(p.y)}`)
    .join(" ");
}

/** Merge consecutive collinear segments. */
function simplifyOrthogonal(points: Point[]): Point[] {
  if (points.length <= 2) return points;

  const out: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const a = out[out.length - 1]!;
    const b = points[i]!;
    const c = points[i + 1]!;
    const collinearX = a.x === b.x && b.x === c.x;
    const collinearY = a.y === b.y && b.y === c.y;
    if (collinearX || collinearY) continue;
    out.push(b);
  }
  out.push(points[points.length - 1]!);
  return out;
}

function orthogonalViaMidX(src: Point, tgt: Point): Point[] {
  const midX = (src.x + tgt.x) / 2;
  return simplifyOrthogonal([
    src,
    { x: midX, y: src.y },
    { x: midX, y: tgt.y },
    tgt,
  ]);
}

function orthogonalViaMidY(src: Point, tgt: Point): Point[] {
  const midY = (src.y + tgt.y) / 2;
  return simplifyOrthogonal([
    src,
    { x: src.x, y: midY },
    { x: tgt.x, y: midY },
    tgt,
  ]);
}

function sameColumn(from: DAGLayoutNode, to: DAGLayoutNode): boolean {
  const fromCx = from.x + from.width / 2;
  const toCx = to.x + to.width / 2;
  const tol = Math.min(from.width, to.width) * 0.55;
  return Math.abs(fromCx - toCx) <= tol;
}

function routeSameRank(from: DAGLayoutNode, to: DAGLayoutNode): RoutedEdge {
  if (sameColumn(from, to)) {
    if (from.y + from.height <= to.y + 1) {
      const points = [nodeAnchor(from, "bottom"), nodeAnchor(to, "top")];
      return { pathD: pointsToPath(points), points };
    }
    if (to.y + to.height <= from.y + 1) {
      const points = [nodeAnchor(from, "top"), nodeAnchor(to, "bottom")];
      return { pathD: pointsToPath(points), points };
    }
  }

  if (from.x + from.width <= to.x) {
    const points = orthogonalViaMidX(nodeAnchor(from, "right"), nodeAnchor(to, "left"));
    return { pathD: pointsToPath(points), points };
  }

  if (to.x + to.width <= from.x) {
    const points = orthogonalViaMidX(nodeAnchor(from, "left"), nodeAnchor(to, "right"));
    return { pathD: pointsToPath(points), points };
  }

  const points = orthogonalViaMidY(nodeAnchor(from, "bottom"), nodeAnchor(to, "top"));
  return { pathD: pointsToPath(points), points };
}

function routeForward(from: DAGLayoutNode, to: DAGLayoutNode): RoutedEdge {
  const points = orthogonalViaMidX(nodeAnchor(from, "right"), nodeAnchor(to, "left"));
  return { pathD: pointsToPath(points), points };
}

function routeBackwardLeft(
  from: DAGLayoutNode,
  to: DAGLayoutNode
): RoutedEdge {
  const src = nodeAnchor(from, "left");
  const tgt = nodeAnchor(to, "right");
  if (Math.abs(src.y - tgt.y) < 1) {
    const points = [src, tgt];
    return { pathD: pointsToPath(points), points };
  }
  const points = orthogonalViaMidX(src, tgt);
  return { pathD: pointsToPath(points), points };
}

function routeBottomChannel(
  from: DAGLayoutNode,
  to: DAGLayoutNode,
  channelY: number
): RoutedEdge {
  const src = nodeAnchor(from, "bottom");
  const tgt =
    to.x + to.width < from.x
      ? nodeAnchor(to, "bottom")
      : nodeAnchor(to, to.y + to.height / 2 < src.y ? "top" : "bottom");

  const points = simplifyOrthogonal([
    src,
    { x: src.x, y: channelY },
    { x: tgt.x, y: channelY },
    tgt,
  ]);
  return { pathD: pointsToPath(points), points };
}

export type RouteDagEdgeOptions = {
  lane: DagEdgeLane;
  isBackEdge: boolean;
  /** max(node.y + node.height) in layout coordinates */
  layoutBottom: number;
};

/**
 * Orthogonal edge path anchored on node borders (no center lines, no node crossing).
 */
export function routeDagEdge(
  from: DAGLayoutNode,
  to: DAGLayoutNode,
  options: RouteDagEdgeOptions
): RoutedEdge {
  const { lane, isBackEdge, layoutBottom } = options;
  const rankDelta = to.rank - from.rank;

  if (rankDelta === 0) {
    return routeSameRank(from, to);
  }

  const targetIsLeft = to.x + to.width <= from.x + 1;

  if (rankDelta < 0 || isBackEdge) {
    if (targetIsLeft) {
      return routeBackwardLeft(from, to);
    }
    const channelY = layoutBottom + 14;
    return routeBottomChannel(from, to, channelY);
  }

  if (lane === "side" && rankDelta > 0 && !sameColumn(from, to)) {
    const points = orthogonalViaMidX(nodeAnchor(from, "right"), nodeAnchor(to, "left"));
    return { pathD: pointsToPath(points), points };
  }

  return routeForward(from, to);
}

export function layoutBottomY(nodes: DAGLayoutNode[]): number {
  if (nodes.length === 0) return 0;
  return Math.max(...nodes.map((n) => n.y + n.height));
}
