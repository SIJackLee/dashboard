import type { ChannelSlot } from "@/lib/data/iot-channel";
import {
  thermoValuesMatch,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";

export type PanelDraft = {
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
};

export type PanelThermoValues = Pick<
  ControllerThermoSettings,
  "setpointTemp" | "tempDeviation" | "minVentPct" | "maxVentPct"
>;

export type PanelChannelContext = {
  slot: ChannelSlot;
  eqpmnCode: string;
  knownSettings: ControllerThermoSettings | null;
  liveBaseline: PanelThermoValues | null;
};

export function panelChannelKey(channel?: ChannelSlot | null): string {
  return channel ?? "";
}

/** 채널 비교 기준 — LIVE를 우선. 컨트롤러 공통 설정으로 B·C를 덮지 않는다. */
export function currentThermoForChannel(
  known: ControllerThermoSettings | null,
  live: PanelThermoValues | null,
): PanelThermoValues | null {
  if (live) return live;
  return known;
}

export function dirtyBaselineForChannel(
  saveBaseline: PanelDraft | null | undefined,
  known: ControllerThermoSettings | null,
  live: PanelThermoValues | null,
): PanelThermoValues | null {
  if (saveBaseline) return saveBaseline;
  return currentThermoForChannel(known, live);
}

export function isChannelDraftDirty(
  draft: PanelDraft | null | undefined,
  baseline: PanelThermoValues | null,
): boolean {
  if (!draft) return false;
  if (!baseline) return true;
  return !thermoValuesMatch(draft, baseline);
}

export type DirtyChannelSave = {
  slot: ChannelSlot;
  eqpmnCode: string;
  values: PanelDraft;
  current: PanelThermoValues | null;
};

const CHANNEL_SAVE_ORDER: ChannelSlot[] = ["A", "B", "C"];

/** 탭을 바꿔도 유지된 채널 초안 중, LIVE/채널 설정과 다른 것만 모은다. */
export function collectDirtyChannelSaves(
  channels: PanelChannelContext[],
  draftByKey: Record<string, PanelDraft | null | undefined>,
  saveBaselineByKey: Record<string, PanelDraft | null | undefined>,
): DirtyChannelSave[] {
  const out: DirtyChannelSave[] = [];
  for (const ctx of channels) {
    const draft = draftByKey[ctx.slot];
    const baseline = dirtyBaselineForChannel(
      saveBaselineByKey[ctx.slot],
      ctx.knownSettings,
      ctx.liveBaseline,
    );
    if (!isChannelDraftDirty(draft, baseline) || !draft) continue;
    out.push({
      slot: ctx.slot,
      eqpmnCode: ctx.eqpmnCode,
      values: draft,
      current: currentThermoForChannel(ctx.knownSettings, ctx.liveBaseline),
    });
  }
  return out;
}

/**
 * 적용 클릭 스냅샷 + 보내기 직전 최신 초안을 합친다.
 * 마지막 채널 입력이 스냅샷보다 늦게 커밋돼도 빠지지 않게 한다.
 */
export function mergeDirtyChannelSaves(
  snapshot: DirtyChannelSave[],
  latest: DirtyChannelSave[],
): DirtyChannelSave[] {
  const latestBySlot = new Map(latest.map((row) => [row.slot, row]));
  const snapshotBySlot = new Map(snapshot.map((row) => [row.slot, row]));
  const slots = new Set<ChannelSlot>([
    ...snapshot.map((row) => row.slot),
    ...latest.map((row) => row.slot),
  ]);
  return CHANNEL_SAVE_ORDER.filter((slot) => slots.has(slot)).map(
    (slot) => latestBySlot.get(slot) ?? snapshotBySlot.get(slot)!,
  );
}
