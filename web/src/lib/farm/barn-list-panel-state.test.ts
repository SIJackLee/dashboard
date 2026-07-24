/**
 * 실행: npx tsx src/lib/farm/barn-list-panel-state.test.ts
 */
import assert from "node:assert/strict";
import {
  closeBarnListSettingsForKey,
  expandBarnListCardBody,
  isBarnListCardBodyCollapsed,
  isBarnListGraphExpanded,
  isBarnListSettingsExpanded,
  toggleBarnListCardBody,
  type BarnListPanelSets,
} from "./barn-list-panel-state";

const empty: BarnListPanelSets = {
  graphKeys: new Set(),
  settingsKeys: new Set(),
};

function withSettings(key: string): BarnListPanelSets {
  return { graphKeys: new Set(), settingsKeys: new Set([key]) };
}

{
  const key = "c1";
  assert.equal(
    isBarnListGraphExpanded(key, "graph", withSettings(key)),
    true,
    "graph mode keeps graph open when settings open",
  );
  assert.equal(
    isBarnListGraphExpanded(key, "controller", withSettings(key)),
    false,
    "controller mode still hides graph when settings open",
  );
  assert.equal(
    isBarnListGraphExpanded(key, "graph", empty),
    true,
    "graph mode expands all graphs",
  );
}

{
  const key = "c1";
  assert.equal(
    isBarnListSettingsExpanded(key, "graph", withSettings(key)),
    true,
  );
  assert.equal(
    isBarnListSettingsExpanded(key, "graph", empty),
    false,
    "graph mode does not force all settings open",
  );
  assert.equal(
    isBarnListSettingsExpanded(key, "settings", empty),
    true,
  );
}

{
  const key = "c1";
  const none = new Set<string>();
  assert.equal(isBarnListCardBodyCollapsed(key, "graph", none), true);
  assert.equal(
    isBarnListCardBodyCollapsed(key, "graph", new Set([key])),
    false,
  );
  assert.equal(isBarnListCardBodyCollapsed(key, "controller", none), false);
  assert.equal(isBarnListCardBodyCollapsed(key, "settings", none), false);
}

{
  const key = "c1";
  const expanded = toggleBarnListCardBody(new Set(), key);
  assert.ok(expanded.has(key));
  const collapsed = toggleBarnListCardBody(expanded, key);
  assert.equal(collapsed.has(key), false);

  const already = expandBarnListCardBody(new Set([key]), key);
  assert.ok(already.has(key));
  const fromEmpty = expandBarnListCardBody(new Set(), key);
  assert.ok(fromEmpty.has(key));
}

{
  const key = "c1";
  const closed = closeBarnListSettingsForKey(
    {
      graphKeys: new Set(["g"]),
      settingsKeys: new Set([key, "other"]),
    },
    key,
  );
  assert.ok(closed.graphKeys.has("g"));
  assert.equal(closed.settingsKeys.has(key), false);
  assert.ok(closed.settingsKeys.has("other"));
}

console.log("barn-list-panel-state.test.ts: ok");
