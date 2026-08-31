/**
 * 실행: npx tsx src/components/trends/trend-chart-geometry.test.ts
 */
import assert from "node:assert/strict";
import {
  buildEnvelopePaths,
  buildLineSegments,
  computeTipPlacement,
  domainFor,
  finiteValues,
  nudgeEdgeLabelTops,
  parseScaleEdgeEditSeed,
  parseScaleEdgeValueUnit,
  tipPinId,
  type EdgeBandLabel,
} from "./trend-chart-geometry";
import type {
  TrendEnvelope,
  TrendSeries,
} from "@/lib/data/trend-chart-types";

// 좌표 매퍼 스텁 — 인덱스=x, 값=y (axis 무시).
const xForId = (i: number) => i;
const yForId = (v: number) => v;

// domainFor: forced 우선, 빈 배열 fallback, 동일값 확장, 패딩.
assert.deepEqual(domainFor([1, 2, 3], [0, 10]), [0, 10]);
assert.deepEqual(domainFor([], undefined), [0, 1]);
{
  // 동일값 → ±1 확장 후 패딩까지 적용.
  const [lo, hi] = domainFor([5, 5], undefined);
  assert.ok(lo < 4 && hi > 6, "동일값은 확장+패딩으로 넓혀야 함");
}
{
  const [lo, hi] = domainFor([0, 10], undefined);
  assert.ok(lo < 0 && hi > 10, "패딩이 양끝을 넓혀야 함");
}

// finiteValues: 축 필터 + null/NaN 제거.
const series: TrendSeries[] = [
  { name: "a", data: [1, null, 3], color: "#000", axis: "left" },
  { name: "b", data: [10, 20], color: "#111", axis: "right" },
  { name: "c", data: [Number.NaN, 5], color: "#222" }, // axis 미지정 → left
];
assert.deepEqual(finiteValues(series, "left"), [1, 3, 5]);
assert.deepEqual(finiteValues(series, "right"), [10, 20]);

// parseScaleEdgeValueUnit: 숫자 뒤 단위 접미.
assert.equal(parseScaleEdgeValueUnit("28.5℃"), "℃");
assert.equal(parseScaleEdgeValueUnit("+5℃"), "℃");
assert.equal(parseScaleEdgeValueUnit("100%"), "%");
assert.equal(parseScaleEdgeValueUnit("42"), "");

// parseScaleEdgeEditSeed: editValue 우선, 없으면 텍스트에서 숫자 추출.
assert.equal(parseScaleEdgeEditSeed({ editValue: 12.5, text: "x" }), "12.5");
assert.equal(parseScaleEdgeEditSeed({ editValue: undefined, text: "-3.2℃" }), "-3.2");
assert.equal(parseScaleEdgeEditSeed({ editValue: undefined, text: "n/a" }), "");

// tipPinId: idx + 추론 그룹.
assert.equal(tipPinId(3, "온도"), tipPinId(3, "온도"));
assert.ok(tipPinId(3, "온도").startsWith("3::"));

// computeTipPlacement: 플롯 경계 안에 클램프.
{
  const p = computeTipPlacement(10, 10, 400, 300);
  assert.ok(p.left >= 0 && p.left <= 400, "left in bounds");
  assert.ok(p.top >= 0 && p.top <= 300, "top in bounds");
}

// nudgeEdgeLabelTops: 같은 side 근접 라벨을 최소 간격으로 벌림.
{
  const labels: EdgeBandLabel[] = [
    { id: "1", side: "left", topPct: 10, text: "a", color: "#000", title: "a" },
    { id: "2", side: "left", topPct: 11, text: "b", color: "#000", title: "b" },
  ];
  const out = nudgeEdgeLabelTops(labels, 5);
  const tops = out.map((l) => l.topPct).sort((a, b) => a - b);
  assert.ok(tops[1]! - tops[0]! >= 5, "최소 간격 확보");
}

// buildLineSegments: null에서 세그먼트가 끊긴다.
{
  const s: TrendSeries = {
    name: "t",
    data: [1, 2, null, 4, 5],
    color: "#000",
  };
  const segs = buildLineSegments(s, xForId, yForId);
  assert.equal(segs.length, 2, "null 기준 2개 세그먼트");
  assert.equal(segs[0], "0.00,1.00 1.00,2.00");
  assert.equal(segs[1], "3.00,4.00 4.00,5.00");
}
// 단일 포인트 세그먼트(길이 1)는 버려진다.
{
  const s: TrendSeries = { name: "t", data: [1, null, 3], color: "#000" };
  assert.deepEqual(buildLineSegments(s, xForId, yForId), []);
}

// buildEnvelopePaths: high/low 유효 구간을 닫힌 path로.
{
  const env: TrendEnvelope = {
    high: [2, 3, 4],
    low: [1, 1, 1],
  } as TrendEnvelope;
  const paths = buildEnvelopePaths(env, 3, xForId, yForId);
  assert.equal(paths.length, 1);
  assert.ok(paths[0]!.startsWith("M") && paths[0]!.endsWith("Z"));
}
// 길이 < 2 → 빈 배열.
{
  const env: TrendEnvelope = { high: [2], low: [1] } as TrendEnvelope;
  assert.deepEqual(buildEnvelopePaths(env, 1, xForId, yForId), []);
}

console.log("trend-chart-geometry.test.ts: ok");
