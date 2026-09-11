/**
 * 명령 적중 레인 클러스터링 — 단계(행)별로 픽셀상 겹치는 마크를 +N 클러스터로 묶는다.
 *
 * 순수 함수. 렌더 좌표(px)만 입력받아 그룹을 계산하므로 TrendChart 내부에 의존하지 않는다.
 * 겹치지 않으면(또는 minGapPx<=0) 모든 마크가 single로 나와 오늘과 동일한 1:1 렌더가 된다.
 */

export type ClusterInputMark = {
  id: string;
  /** 0 = 맨 위 행(단계). command 레인에서는 COMMAND_HIT_STAGES 인덱스와 동일. */
  row: number;
  /** 플롯 내부 픽셀 x. */
  xPx: number;
};

export type EventCluster = {
  id: string;
  row: number;
  /** 멤버 평균 x(px) — 배지 중심. */
  centerXPx: number;
  /** 항상 2개 이상. 입력 x 오름차순. */
  memberIds: string[];
};

export type EventClusterLayout = {
  /** 단독으로 렌더할 마크 id. */
  singleIds: Set<string>;
  clusters: EventCluster[];
  /** 멤버 id → 클러스터 id. */
  clusterOf: Map<string, string>;
};

/**
 * 같은 행에서 x가 오름차순으로 인접 간격이 minGapPx 미만이면 하나의 클러스터로 이어 묶는다.
 * (캔버스 프로토타입의 단계별 클러스터 모델과 동일.)
 */
export function clusterEventMarks(
  marks: ReadonlyArray<ClusterInputMark>,
  minGapPx: number,
): EventClusterLayout {
  const singleIds = new Set<string>();
  const clusters: EventCluster[] = [];
  const clusterOf = new Map<string, string>();

  if (!(minGapPx > 0)) {
    for (const m of marks) singleIds.add(m.id);
    return { singleIds, clusters, clusterOf };
  }

  const byRow = new Map<number, ClusterInputMark[]>();
  for (const m of marks) {
    const arr = byRow.get(m.row);
    if (arr) arr.push(m);
    else byRow.set(m.row, [m]);
  }

  for (const [row, arr] of byRow) {
    arr.sort((a, b) => a.xPx - b.xPx || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

    let group: ClusterInputMark[] = [];
    const flush = () => {
      if (group.length === 0) return;
      if (group.length === 1) {
        singleIds.add(group[0]!.id);
      } else {
        const centerXPx =
          group.reduce((sum, g) => sum + g.xPx, 0) / group.length;
        const memberIds = group.map((g) => g.id);
        const id = `cl:${row}:${memberIds[0]}`;
        clusters.push({ id, row, centerXPx, memberIds });
        for (const mid of memberIds) clusterOf.set(mid, id);
      }
      group = [];
    };

    for (const m of arr) {
      if (group.length === 0) {
        group.push(m);
        continue;
      }
      const prev = group[group.length - 1]!;
      if (m.xPx - prev.xPx < minGapPx) group.push(m);
      else {
        flush();
        group.push(m);
      }
    }
    flush();
  }

  return { singleIds, clusters, clusterOf };
}
