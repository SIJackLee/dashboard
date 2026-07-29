/**
 * 실행: npx tsx src/components/farm/unified-trend-period-brush.test.ts
 */
import assert from "node:assert/strict";
import {
  BRUSH_PERIOD_WINDOW,
  resolveBrushPeriodFromDraft,
  snapBrushSpanToPeriod,
} from "./unified-trend-period-brush";

{
  assert.equal(snapBrushSpanToPeriod(0.03), "24h");
  assert.equal(snapBrushSpanToPeriod(0.08), "24h");
  assert.equal(snapBrushSpanToPeriod(0.2), "7d");
  assert.equal(snapBrushSpanToPeriod(0.35), "7d");
  assert.equal(snapBrushSpanToPeriod(0.5), "30d");
}

{
  // 폭 우선 — 왼쪽에서 넓게 끌어도 30d (위치가 아닌 폭)
  assert.equal(resolveBrushPeriodFromDraft(0.05, 0.7), "30d");
  // 좁은 폭 → 24h, 적용 윈도우는 우측 정렬
  assert.equal(resolveBrushPeriodFromDraft(0.1, 0.15), "24h");
  assert.equal(resolveBrushPeriodFromDraft(0.4, 0.55), "7d");
}

{
  // 거의 클릭 — 위치 존 (최근 정렬 윈도우와 동일 경계)
  const tap24 = BRUSH_PERIOD_WINDOW["24h"].start + 0.005;
  assert.equal(resolveBrushPeriodFromDraft(tap24, tap24), "24h");
  const tap7 =
    (BRUSH_PERIOD_WINDOW["7d"].start + BRUSH_PERIOD_WINDOW["24h"].start) / 2;
  assert.equal(resolveBrushPeriodFromDraft(tap7, tap7), "7d");
  assert.equal(resolveBrushPeriodFromDraft(0.1, 0.11), "30d");
}

{
  // 확정 윈도우는 항상 우측(최근) 정렬
  assert.equal(BRUSH_PERIOD_WINDOW["30d"].start, 0);
  assert.equal(BRUSH_PERIOD_WINDOW["30d"].width, 1);
  assert.ok(BRUSH_PERIOD_WINDOW["7d"].start > 0.7);
  assert.ok(BRUSH_PERIOD_WINDOW["24h"].start > BRUSH_PERIOD_WINDOW["7d"].start);
}

console.log("unified-trend-period-brush.test.ts: ok");
