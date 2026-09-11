import assert from "node:assert/strict";
import { test } from "node:test";
import {
  clusterEventMarks,
  type ClusterInputMark,
} from "./command-cluster";

const m = (id: string, row: number, xPx: number): ClusterInputMark => ({
  id,
  row,
  xPx,
});

test("겹치지 않으면 모두 single (오늘과 동일한 1:1)", () => {
  const layout = clusterEventMarks(
    [m("a", 0, 0), m("b", 0, 100), m("c", 0, 200)],
    24,
  );
  assert.equal(layout.clusters.length, 0);
  assert.deepEqual([...layout.singleIds].sort(), ["a", "b", "c"]);
});

test("minGapPx<=0이면 클러스터링 비활성(전부 single)", () => {
  const layout = clusterEventMarks([m("a", 0, 0), m("b", 0, 1)], 0);
  assert.equal(layout.clusters.length, 0);
  assert.equal(layout.singleIds.size, 2);
});

test("인접 간격이 임계 미만이면 하나로 묶인다", () => {
  const layout = clusterEventMarks(
    [m("a", 0, 0), m("b", 0, 10), m("c", 0, 20)],
    24,
  );
  assert.equal(layout.clusters.length, 1);
  assert.equal(layout.singleIds.size, 0);
  const cl = layout.clusters[0]!;
  assert.deepEqual(cl.memberIds, ["a", "b", "c"]);
  assert.equal(cl.row, 0);
  assert.equal(cl.centerXPx, 10);
  assert.equal(layout.clusterOf.get("b"), cl.id);
});

test("체인이 끊기면 별도 클러스터/single로 분리", () => {
  // a,b 근접 → 클러스터 / c 멀리 → single
  const layout = clusterEventMarks(
    [m("a", 0, 0), m("b", 0, 10), m("c", 0, 100)],
    24,
  );
  assert.equal(layout.clusters.length, 1);
  assert.deepEqual(layout.clusters[0]!.memberIds, ["a", "b"]);
  assert.deepEqual([...layout.singleIds], ["c"]);
});

test("행(단계)별로 격리되어 묶인다", () => {
  const layout = clusterEventMarks(
    [m("a", 0, 0), m("b", 1, 5), m("c", 0, 8)],
    24,
  );
  // 같은 x대라도 row가 다르면 묶이지 않음
  assert.equal(layout.clusters.length, 1);
  const cl = layout.clusters[0]!;
  assert.deepEqual(cl.memberIds, ["a", "c"]);
  assert.equal(cl.row, 0);
  assert.deepEqual([...layout.singleIds], ["b"]);
});

test("입력 순서와 무관하게 x 오름차순으로 정렬해 묶는다", () => {
  const layout = clusterEventMarks(
    [m("c", 0, 20), m("a", 0, 0), m("b", 0, 10)],
    24,
  );
  assert.deepEqual(layout.clusters[0]!.memberIds, ["a", "b", "c"]);
});
