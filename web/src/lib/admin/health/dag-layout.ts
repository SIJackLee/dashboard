export type DAGLayoutOptions = {
  nodes: Array<{ id: string }>;
  edges: Array<{ from: string; to: string }>;
  direction?: "vertical" | "horizontal";
  nodeWidth?: number;
  nodeHeight?: number;
  rankGap?: number;
  nodeGap?: number;
  padding?: number;
  /** 지정 시 longest-path 대신 고정 rank (현장 펼침 등 가로 확장용) */
  rankOverrides?: Record<string, number>;
  /** 노드별 가로폭 (S4 가변폭) — 미지정 시 nodeWidth */
  nodeWidthById?: Record<string, number>;
  /** 노드별 세로높이 — 미지정 시 nodeHeight */
  nodeHeightById?: Record<string, number>;
  /** 지정 시 가로 전체를 spreadZones개 구역으로 나누어 rank별 중앙 정렬 */
  spreadWidth?: number;
  /** spreadWidth 사용 시 구역 수 (기본: rank 개수) */
  spreadZones?: number;
  /** rank별 그리드 열 수 (P2: 농장 rank 2열) */
  rankColumns?: Record<number, number>;
  /** rank 그리드 열 간격 (기본: nodeGap) */
  rankColGap?: number;
};

export type DAGLayoutNode = {
  id: string;
  x: number;
  y: number;
  rank: number;
  order: number;
  width: number;
  height: number;
};

export type DAGLayoutEdge = {
  from: string;
  to: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isBackEdge: boolean;
};

export type DAGLayoutRank = {
  rank: number;
  x: number;
  y: number;
  width: number;
  height: number;
  nodeIds: string[];
};

export type DAGLayoutResult = {
  nodes: DAGLayoutNode[];
  edges: DAGLayoutEdge[];
  ranks: DAGLayoutRank[];
  direction: "vertical" | "horizontal";
  width: number;
  height: number;
};

function edgeKey(from: string, to: string): string {
  return `${from}->${to}`;
}

function resolveNodeWidth(
  id: string,
  nodeWidth: number,
  nodeWidthById?: Record<string, number>
): number {
  return nodeWidthById?.[id] ?? nodeWidth;
}

function resolveNodeHeight(
  id: string,
  nodeHeight: number,
  nodeHeightById?: Record<string, number>
): number {
  return nodeHeightById?.[id] ?? nodeHeight;
}

/** 계층 DAG 배치 (horizontal: 좌→우 rank, vertical: 상→하 rank) */
export function computeDAGLayout(options: DAGLayoutOptions): DAGLayoutResult {
  const {
    nodes,
    edges,
    direction = "vertical",
    nodeWidth = 160,
    nodeHeight = 40,
    rankGap = 64,
    nodeGap = 48,
    padding = 24,
    rankOverrides,
    nodeWidthById,
    nodeHeightById,
    spreadWidth,
    spreadZones,
    rankColumns = {},
    rankColGap,
  } = options;

  const colGap = rankColGap ?? nodeGap;

  const nodeIds = nodes.map((n) => n.id);
  const idSet = new Set(nodeIds);

  const adj = new Map<string, string[]>();
  const rev = new Map<string, string[]>();
  for (const id of nodeIds) {
    adj.set(id, []);
    rev.set(id, []);
  }

  for (const e of edges) {
    if (!idSet.has(e.from) || !idSet.has(e.to)) continue;
    adj.get(e.from)!.push(e.to);
    rev.get(e.to)!.push(e.from);
  }

  const backEdges = new Set<string>();
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(id: string) {
    visited.add(id);
    stack.add(id);
    for (const to of adj.get(id) ?? []) {
      if (!visited.has(to)) {
        dfs(to);
      } else if (stack.has(to)) {
        backEdges.add(edgeKey(id, to));
      }
    }
    stack.delete(id);
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) dfs(id);
  }

  const forwardEdges = edges.filter(
    (e) => idSet.has(e.from) && idSet.has(e.to) && !backEdges.has(edgeKey(e.from, e.to))
  );

  const rank = new Map<string, number>();
  for (const id of nodeIds) rank.set(id, 0);

  if (rankOverrides) {
    for (const id of nodeIds) {
      if (rankOverrides[id] !== undefined) {
        rank.set(id, rankOverrides[id]!);
      }
    }
  } else {
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of forwardEdges) {
        const next = rank.get(e.from)! + 1;
        if (next > rank.get(e.to)!) {
          rank.set(e.to, next);
          changed = true;
        }
      }
    }
  }

  const rankGroups = new Map<number, string[]>();
  for (const id of nodeIds) {
    const r = rank.get(id)!;
    const group = rankGroups.get(r) ?? [];
    group.push(id);
    rankGroups.set(r, group);
  }

  const rankIndices = [...rankGroups.keys()].sort((a, b) => a - b);

  const heightOf = (id: string) => resolveNodeHeight(id, nodeHeight, nodeHeightById);
  const widthOf = (id: string) => resolveNodeWidth(id, nodeWidth, nodeWidthById);

  const colsForRank = (r: number, ids: string[]) =>
    Math.max(1, Math.min(rankColumns[r] ?? 1, ids.length));

  const rankBandHeightFor = (ids: string[], r: number) => {
    const cols = colsForRank(r, ids);
    if (cols <= 1) {
      return ids.reduce((sum, id, i) => sum + heightOf(id) + (i > 0 ? nodeGap : 0), 0);
    }
    const rows = Math.ceil(ids.length / cols);
    const maxH = Math.max(...ids.map(heightOf), nodeHeight);
    return rows * maxH + Math.max(0, rows - 1) * nodeGap;
  };

  const rankMaxWidthFor = (ids: string[], r: number) => {
    const cols = colsForRank(r, ids);
    const maxW = Math.max(...ids.map(widthOf), nodeWidth);
    if (cols <= 1) return maxW;
    return cols * maxW + (cols - 1) * colGap;
  };

  const positioned: DAGLayoutNode[] = [];
  const rankBoxes: DAGLayoutRank[] = [];

  const rankMaxWidth = new Map<number, number>();
  for (const r of rankIndices) {
    rankMaxWidth.set(r, rankMaxWidthFor(rankGroups.get(r)!, r));
  }

  const maxBandMain = Math.max(
    ...rankIndices.map((r) => rankBandHeightFor(rankGroups.get(r)!, r)),
    nodeHeight
  );

  const maxRankLen = Math.max(
    1,
    ...rankIndices.map((r) => {
      const ids = rankGroups.get(r)!;
      const cols = colsForRank(r, ids);
      return cols <= 1 ? ids.length : Math.ceil(ids.length / cols);
    })
  );

  const rankXStart = new Map<number, number>();
  const useSpread = direction === "horizontal" && spreadWidth != null && spreadWidth > 0;
  const zoneCount = useSpread ? (spreadZones ?? rankIndices.length) : rankIndices.length;

  if (direction === "horizontal") {
    if (useSpread) {
      const innerW = spreadWidth - padding * 2;
      const zoneW = innerW / Math.max(1, zoneCount);
      rankIndices.forEach((r, zoneIdx) => {
        const maxW = rankMaxWidth.get(r)!;
        const zoneLeft = padding + zoneIdx * zoneW;
        rankXStart.set(r, zoneLeft + (zoneW - maxW) / 2);
      });
    } else {
      let cursorX = padding;
      for (const r of rankIndices) {
        rankXStart.set(r, cursorX);
        cursorX += rankMaxWidth.get(r)! + rankGap;
      }
    }
  }

  for (const r of rankIndices) {
    const ids = [...rankGroups.get(r)!].sort();
    const cols = colsForRank(r, ids);
    const bandMain = maxBandMain;
    const bandActual = rankBandHeightFor(ids, r);
    const bandOffset = (bandMain - bandActual) / 2;

    let rankX = 0;
    let rankY = 0;
    let rankW = 0;
    let rankH = 0;

    ids.forEach((id, order) => {
      const w = widthOf(id);
      const h = heightOf(id);
      const col = cols > 1 ? order % cols : 0;
      const row = cols > 1 ? Math.floor(order / cols) : order;
      let x: number;
      let y: number;
      if (direction === "horizontal") {
        if (useSpread) {
          const zoneIdx = rankIndices.indexOf(r);
          const innerW = spreadWidth! - padding * 2;
          const zoneW = innerW / Math.max(1, zoneCount);
          if (cols > 1) {
            const gridW = cols * w + (cols - 1) * colGap;
            const gridLeft = padding + zoneIdx * zoneW + (zoneW - gridW) / 2;
            x = gridLeft + col * (w + colGap);
            y = padding + bandOffset + row * (h + nodeGap);
          } else {
            const zoneCenter = padding + (zoneIdx + 0.5) * zoneW;
            x = zoneCenter - w / 2;
            y = padding + bandOffset + row * (h + nodeGap);
          }
          rankX = padding + zoneIdx * zoneW;
          rankW = zoneW;
        } else {
          if (cols > 1) {
            const gridW = cols * w + (cols - 1) * colGap;
            x = rankXStart.get(r)! + (rankMaxWidth.get(r)! - gridW) / 2 + col * (w + colGap);
            y = padding + bandOffset + row * (h + nodeGap);
          } else {
            x = rankXStart.get(r)!;
            y = padding + bandOffset + order * (h + nodeGap);
          }
          rankX = rankXStart.get(r)!;
          rankW = rankMaxWidth.get(r)!;
        }
        rankY = padding;
        rankH = bandMain;
      } else {
        x = padding + bandOffset + order * (nodeWidth + nodeGap);
        y = padding + r * (nodeHeight + rankGap);
        rankX = padding;
        rankY = y;
        rankW = bandMain;
        rankH = h;
      }
      positioned.push({ id, x, y, rank: r, order, width: w, height: h });
    });

    rankBoxes.push({
      rank: r,
      x: rankX,
      y: rankY,
      width: rankW,
      height: rankH,
      nodeIds: ids,
    });
  }

  const posById = Object.fromEntries(positioned.map((n) => [n.id, n]));

  const layoutEdges: DAGLayoutEdge[] = edges
    .filter((e) => idSet.has(e.from) && idSet.has(e.to))
    .map((e) => {
      const from = posById[e.from];
      const to = posById[e.to];
      if (!from || !to) {
        return {
          ...e,
          sourceX: 0,
          sourceY: 0,
          targetX: 0,
          targetY: 0,
          isBackEdge: backEdges.has(edgeKey(e.from, e.to)),
        };
      }

      let sourceX: number;
      let sourceY: number;
      let targetX: number;
      let targetY: number;

      if (direction === "horizontal") {
        const fromW = widthOf(from.id);
        const fromH = heightOf(from.id);
        const toH = heightOf(to.id);
        sourceX = from.x + fromW;
        sourceY = from.y + fromH / 2;
        targetX = to.x;
        targetY = to.y + toH / 2;
      } else {
        sourceX = from.x + nodeWidth / 2;
        sourceY = from.y + nodeHeight;
        targetX = to.x + nodeWidth / 2;
        targetY = to.y;
      }

      return {
        from: e.from,
        to: e.to,
        sourceX,
        sourceY,
        targetX,
        targetY,
        isBackEdge: backEdges.has(edgeKey(e.from, e.to)),
      };
    });

  let width = padding * 2;
  let height = padding * 2;

  if (direction === "horizontal") {
    if (useSpread) {
      width = spreadWidth!;
    } else {
      const totalRankWidth = rankIndices.reduce(
        (sum, r) => sum + rankMaxWidth.get(r)!,
        0
      );
      const gapTotal = rankIndices.length > 0 ? (rankIndices.length - 1) * rankGap : 0;
      width = padding * 2 + totalRankWidth + gapTotal;
    }
    height = padding * 2 + maxBandMain;
  } else {
    const maxRank = rankIndices.length > 0 ? Math.max(...rankIndices) : 0;
    width =
      padding * 2 +
      maxRankLen * nodeWidth +
      Math.max(0, maxRankLen - 1) * nodeGap;
    height = padding * 2 + (maxRank + 1) * nodeHeight + maxRank * rankGap;
  }

  return {
    nodes: positioned,
    edges: layoutEdges,
    ranks: rankBoxes,
    direction,
    width,
    height,
  };
}
