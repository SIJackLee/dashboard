/**
 * 실행: npx tsx src/components/trends/trend-chart-geometry.test.ts
 */
import assert from "node:assert/strict";
import {
  computeTipPlacement,
  domainFor,
  finiteValues,
  nudgeEdgeLabelTops,
  parseScaleEdgeEditSeed,
  parseScaleEdgeValueUnit,
  tipPinId,
  type EdgeBandLabel,
} from "./trend-chart-geometry";
import type { TrendSeries } from "@/lib/data/trend-chart-types";

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

console.log("trend-chart-geometry.test.ts: ok");
