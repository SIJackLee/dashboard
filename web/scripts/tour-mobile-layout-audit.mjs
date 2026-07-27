/**
 * Tour mobile dock / hole-tooltip overlap — 정적 검수.
 * Usage: node scripts/tour-mobile-layout-audit.mjs
 */
import assert from "node:assert/strict";

function resolveTourTooltipDock(hole, vh) {
  if (!hole || hole.height <= 0) return "bottom";
  const mid = hole.top + hole.height / 2;
  return mid > vh * 0.42 ? "top" : "bottom";
}

function measureTourHoleTooltipOverlap(hole, tip) {
  const x1 = Math.max(hole.left, tip.left);
  const y1 = Math.max(hole.top, tip.top);
  const x2 = Math.min(hole.left + hole.width, tip.left + tip.width);
  const y2 = Math.min(hole.top + hole.height, tip.top + tip.height);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}

const VH = 800;
const VW = 390;

/** 하단 시트 타깃 → 상단 도킹 */
{
  const hole = { top: 420, left: 16, width: 358, height: 280 };
  const dock = resolveTourTooltipDock(hole, VH);
  assert.equal(dock, "top");
  const tip = { top: 8, left: 8, width: VW - 16, height: 280 };
  assert.equal(measureTourHoleTooltipOverlap(hole, tip), 0, "top dock must not cover lower hole");
}

/** 상단 헤더 타깃 → 하단 도킹 */
{
  const hole = { top: 8, left: 0, width: VW, height: 56 };
  const dock = resolveTourTooltipDock(hole, VH);
  assert.equal(dock, "bottom");
  const tip = { top: VH - 300, left: 8, width: VW - 16, height: 280 };
  assert.equal(measureTourHoleTooltipOverlap(hole, tip), 0, "bottom dock must not cover header hole");
}

/** 잘못된 하단 도킹이 시트 hole을 덮는 경우(회귀 감지) */
{
  const hole = { top: 420, left: 16, width: 358, height: 280 };
  const badTip = { top: VH - 320, left: 8, width: VW - 16, height: 300 };
  assert.ok(
    measureTourHoleTooltipOverlap(hole, badTip) > 1000,
    "legacy bottom-dock over sheet would overlap",
  );
}

/** 축사 카드(중상단) → 하단 도킹 */
{
  const hole = { top: 120, left: 12, width: 366, height: 180 };
  assert.equal(resolveTourTooltipDock(hole, VH), "bottom");
}

console.log("tour-mobile-layout-audit: ok");
