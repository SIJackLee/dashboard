/**
 * 실행: npx tsx src/lib/farm/barn-model-mode.test.ts
 */
import assert from "node:assert/strict";
import {
  BARN_MODEL_VIEW_INIT,
  barnModelEntranceSettled,
  barnModelFieldTrendTy,
  barnModelFillEditId,
  barnModelMobileChartReady,
  barnModelPlacing,
  barnModelRoofFocusId,
  barnModelShot,
  barnModelYardEditing,
  reduceBarnModelView,
  type BarnPlaceDraft,
  type BarnModelViewState,
} from "./barn-model-mode";

const draft: BarnPlaceDraft = {
  stallTyCode: "SP02",
  stallNo: "01",
  plan: { left: 4, right: 4 },
  label: "분만사 01",
};

function apply(
  start: BarnModelViewState,
  ...actions: Parameters<typeof reduceBarnModelView>[1][]
) {
  return actions.reduce(reduceBarnModelView, start);
}

{
  const s = apply(BARN_MODEL_VIEW_INIT, { type: "startPlacing", draft });
  assert.equal(barnModelShot(s.mode), "roof");
  assert.equal(s.selectedBarnId, null);
  assert.equal(barnModelPlacing(s.mode)?.label, draft.label);
  const esc = apply(s, { type: "escape" });
  assert.equal(esc.mode.kind, "field");
  assert.equal(barnModelPlacing(esc.mode), null);
}

{
  const s = apply(BARN_MODEL_VIEW_INIT, { type: "toggleEdit" });
  assert.ok(barnModelYardEditing(s.mode));
  assert.equal(barnModelFillEditId(s.mode), null);
  const fill = apply(s, { type: "setFillEdit", barnId: "b1" });
  assert.equal(barnModelFillEditId(fill.mode), "b1");
  const escFill = apply(fill, { type: "escape" });
  assert.ok(barnModelYardEditing(escFill.mode));
  assert.equal(barnModelFillEditId(escFill.mode), null);
  const escEdit = apply(escFill, { type: "escape" });
  assert.equal(escEdit.mode.kind, "field");
}

{
  const s = apply(BARN_MODEL_VIEW_INIT, {
    type: "openEntrance",
    barnId: "b1",
  });
  assert.equal(barnModelShot(s.mode), "entrance");
  assert.equal(s.selectedBarnId, "b1");
  assert.equal(s.paletteOpen, false);
  assert.equal(barnModelEntranceSettled(s.mode), false);
  const arrived = apply(s, { type: "entranceArrived" });
  assert.ok(barnModelEntranceSettled(arrived.mode));
  const back = apply(arrived, { type: "backToField" });
  assert.equal(back.mode.kind, "field");
  assert.equal(back.selectedBarnId, "b1");
}

{
  const s = apply(
    BARN_MODEL_VIEW_INIT,
    { type: "setPaletteOpen", open: true },
    { type: "toggleTrend", barnId: "b1", stallTyCode: "SP02" },
    { type: "focusBarn", barnId: "b2" },
  );
  assert.equal(s.selectedBarnId, "b2");
  assert.equal(barnModelFieldTrendTy(s.mode), "SP02");
  assert.equal(barnModelRoofFocusId(s.mode), "b2");
  const escTrend = apply(s, { type: "escape" });
  assert.equal(barnModelFieldTrendTy(escTrend.mode), null);
  assert.equal(barnModelRoofFocusId(escTrend.mode), "b2");
  const escFocus = apply(escTrend, { type: "escape" });
  assert.equal(barnModelRoofFocusId(escFocus.mode), null);
}

{
  const placing = apply(BARN_MODEL_VIEW_INIT, {
    type: "startPlacing",
    draft,
  });
  const ignore = apply(placing, { type: "selectBarn", barnId: "b1" });
  assert.equal(ignore.selectedBarnId, null);
  const placed = apply(placing, { type: "placed", barnId: "b9" });
  assert.equal(placed.selectedBarnId, "b9");
  assert.equal(placed.mode.kind, "field");
}

{
  const ent = apply(BARN_MODEL_VIEW_INIT, {
    type: "openEntrance",
    barnId: "b1",
  });
  const del = apply(ent, { type: "deleteBarn", barnId: "b1" });
  assert.equal(del.mode.kind, "field");
  assert.equal(del.selectedBarnId, null);
}

{
  const ent = apply(BARN_MODEL_VIEW_INIT, {
    type: "openEntrance",
    barnId: "b1",
  });
  assert.equal(barnModelMobileChartReady(ent.mode), false);
  const arrived = apply(ent, { type: "entranceArrived" });
  assert.equal(barnModelMobileChartReady(arrived.mode), true);
  const trend = apply(BARN_MODEL_VIEW_INIT, {
    type: "toggleTrend",
    barnId: "b1",
    stallTyCode: "SP02",
  });
  assert.equal(barnModelMobileChartReady(trend.mode), true);
  assert.equal(barnModelMobileChartReady(BARN_MODEL_VIEW_INIT.mode), false);
}

console.log("barn-model-mode.test.ts: ok");
