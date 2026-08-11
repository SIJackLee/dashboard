/**
 * 실행: npx tsx src/components/farm/unified-trend-period-brush.test.ts
 */
import assert from "node:assert/strict";
import {
  BRUSH_PERIOD_WINDOW,
  resolveBrushHighlightWindow,
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
  // 거의 클릭 — null (UI에서 기간 순환)
  const tap24 = BRUSH_PERIOD_WINDOW["24h"].start + 0.005;
  assert.equal(resolveBrushPeriodFromDraft(tap24, tap24), null);
  assert.equal(resolveBrushPeriodFromDraft(0.1, 0.11), null);
}

{
  // 확정 윈도우는 항상 우측(최근) 정렬
  assert.equal(BRUSH_PERIOD_WINDOW["30d"].start, 0);
  assert.equal(BRUSH_PERIOD_WINDOW["30d"].width, 1);
  assert.ok(BRUSH_PERIOD_WINDOW["7d"].start > 0.7);
  assert.ok(BRUSH_PERIOD_WINDOW["24h"].start > BRUSH_PERIOD_WINDOW["7d"].start);
}

{
  const full30 = resolveBrushHighlightWindow("30d", null, 100);
  assert.equal(full30.start, 0);
  assert.equal(full30.width, 1);

  const scoped30 = resolveBrushHighlightWindow(
    "30d",
    { start: 20, end: 80 },
    101,
  );
  assert.ok(Math.abs(scoped30.start - 0.2) < 0.001);
  assert.ok(Math.abs(scoped30.width - 0.6) < 0.001);

  const scoped7Half = resolveBrushHighlightWindow(
    "7d",
    { start: 0, end: 25 },
    51,
  );
  assert.ok(
    Math.abs(scoped7Half.start - BRUSH_PERIOD_WINDOW["7d"].start) < 0.001,
  );
  assert.ok(
    Math.abs(scoped7Half.width - BRUSH_PERIOD_WINDOW["7d"].width * 0.5) < 0.001,
  );
}

console.log("unified-trend-period-brush.test.ts: ok");
