import {
  EMPTY_BARN_LIST_PANEL_SETS,
  isBarnListMotorExpanded,
  isBarnListSettingsExpanded,
  toggleBarnListGraph,
  type BarnListPanelSets,
} from "@/lib/farm/barn-list-panel-state";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

function withGraphOverride(key: string): BarnListPanelSets {
  return toggleBarnListGraph(EMPTY_BARN_LIST_PANEL_SETS, key);
}

/** 설정 모드 → 모터그래프: panelSets 잔존 시 일부 카드만 motor 미확장 */
function testStaleGraphKeysBlockMotorInChannelMode(): void {
  const keyOpen = "farm-a-ctrl-01";
  const keyBlocked = "farm-a-ctrl-02";
  const stale = withGraphOverride(keyBlocked);

  assert(
    isBarnListSettingsExpanded(keyOpen, "settings", EMPTY_BARN_LIST_PANEL_SETS),
    "settings mode: default expand",
  );
  assert(
    !isBarnListMotorExpanded(keyBlocked, "channel", stale),
    "channel + stale graphKeys: motor blocked on that card",
  );
  assert(
    isBarnListMotorExpanded(keyOpen, "channel", stale),
    "channel + stale graphKeys: other cards still expand",
  );
  assert(
    isBarnListMotorExpanded(keyBlocked, "channel", EMPTY_BARN_LIST_PANEL_SETS),
    "channel + cleared panelSets: all cards expand",
  );
}

function run(): void {
  testStaleGraphKeysBlockMotorInChannelMode();
  console.log("barn-list-panel-state.verify.ts OK");
}

run();
