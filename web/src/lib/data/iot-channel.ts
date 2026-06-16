/** v0x0B decoded channels[] → dashboard fields */

export type ChannelSlot = "A" | "B" | "C";

export type DecodedChannel = {
  channel?: string;
  eqpmnCode?: string;
  tempC?: string | number | null;
  humidityPct?: string | number | null;
  outputs?: Record<string, string | number> | null;
  thermo?: {
    setpointTemp?: string | number;
    tempDeviation?: string | number;
    minVentPct?: number;
    maxVentPct?: number;
  } | null;
};

export type ChannelReading = {
  channel: ChannelSlot;
  eqpmnCode: string;
  tempC: number | null;
  humidityPct: number | null;
  fanPct: number | null;
  fanSeries: number[];
  thermo: DecodedChannel["thermo"];
};

const SLOT_ORDER: ChannelSlot[] = ["A", "B", "C"];

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function maxOutput(outputs: Record<string, string | number> | null | undefined): number | null {
  if (!outputs) return null;
  let max: number | null = null;
  for (const raw of Object.values(outputs)) {
    const n = toNum(raw);
    if (n == null) continue;
    max = max == null ? n : Math.max(max, n);
  }
  return max;
}

function outputSeries(outputs: Record<string, string | number> | null | undefined): number[] {
  if (!outputs) return [];
  return Object.keys(outputs)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => toNum(outputs[k]))
    .filter((n): n is number => n != null);
}

export function normalizeChannelSlot(raw: unknown): ChannelSlot | null {
  const s = String(raw ?? "").trim().toUpperCase();
  if (s === "A" || s === "B" || s === "C") return s;
  return null;
}

export function mapDecodedChannels(raw: unknown): ChannelReading[] {
  if (!Array.isArray(raw)) return [];
  const out: ChannelReading[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const ch = item as DecodedChannel;
    const slot = normalizeChannelSlot(ch.channel);
    const eqpmnCode = String(ch.eqpmnCode ?? "").trim();
    if (!slot || !eqpmnCode) continue;
    out.push({
      channel: slot,
      eqpmnCode,
      tempC: toNum(ch.tempC),
      humidityPct: toNum(ch.humidityPct),
      fanPct: maxOutput(ch.outputs ?? undefined),
      fanSeries: outputSeries(ch.outputs ?? undefined),
      thermo: ch.thermo ?? null,
    });
  }
  return out.sort(
    (a, b) => SLOT_ORDER.indexOf(a.channel) - SLOT_ORDER.indexOf(b.channel)
  );
}

export function channelBySlot(
  channels: ChannelReading[],
  slot: ChannelSlot
): ChannelReading | undefined {
  return channels.find((c) => c.channel === slot);
}

/** EC01/02/03 flat fan fields + primary env from channel A (legacy cards) */
export function legacyFieldsFromChannels(channels: ChannelReading[]): {
  tempC: number | null;
  humidityPct: number | null;
  fanSupply: number | null;
  fanExhaust: number | null;
  fanIntake: number | null;
  fanSupplySeries: number[];
  fanExhaustSeries: number[];
  fanIntakeSeries: number[];
  thermo: DecodedChannel["thermo"];
} {
  const byCode = new Map(channels.map((c) => [c.eqpmnCode, c]));
  const chA = channelBySlot(channels, "A");
  const ec01 = byCode.get("EC01");
  const ec02 = byCode.get("EC02");
  const ec03 = byCode.get("EC03");

  return {
    tempC: chA?.tempC ?? channels[0]?.tempC ?? null,
    humidityPct: chA?.humidityPct ?? channels[0]?.humidityPct ?? null,
    fanSupply: ec01?.fanPct ?? null,
    fanExhaust: ec02?.fanPct ?? null,
    fanIntake: ec03?.fanPct ?? null,
    fanSupplySeries: ec01?.fanSeries ?? [],
    fanExhaustSeries: ec02?.fanSeries ?? [],
    fanIntakeSeries: ec03?.fanSeries ?? [],
    thermo: chA?.thermo ?? channels.find((c) => c.thermo)?.thermo ?? null,
  };
}

export const CHANNEL_SLOT_LABELS: Record<ChannelSlot, string> = {
  A: "채널 A",
  B: "채널 B",
  C: "채널 C",
};

export const DEFAULT_CHANNEL_EQPMN: Record<ChannelSlot, string> = {
  A: "EC03",
  B: "EC02",
  C: "EC01",
};

export {
  formatChannelEquipmentLabel,
  formatEqpmnCodeLabel,
} from "@/lib/data/eqpmn-code";
