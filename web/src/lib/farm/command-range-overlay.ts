import { type ChannelSlot } from "@/lib/data/iot-channel";
import type {
  TrendCommandChannelRange,
  TrendCommandRangeFrame,
} from "@/lib/data/trend-chart-types";
import type { FanControlWindow } from "@/lib/farm/channel-thermo";

export const COMMAND_RANGE_CHANNELS: readonly ChannelSlot[] = ["A", "B", "C"];

/** 채널 A 진함 → C 옅음 (면 채움) */
export const COMMAND_RANGE_FILL_OPACITY: Record<ChannelSlot, number> = {
  A: 0.3,
  B: 0.16,
  C: 0.08,
};

/** 구간 경계선 */
export const COMMAND_RANGE_LINE_OPACITY: Record<ChannelSlot, number> = {
  A: 0.88,
  B: 0.52,
  C: 0.28,
};

/**
 * 플롯 inner 너비 비율. 중앙 기준 A 좌 · B 중 · C 우.
 * textAnchor는 A=end, B=middle, C=start 로 겹침을 줄인다.
 */
export const COMMAND_RANGE_LABEL_T: Record<ChannelSlot, number> = {
  A: 0.38,
  B: 0.5,
  C: 0.62,
};

export const COMMAND_RANGE_LABEL_ANCHOR: Record<
  ChannelSlot,
  "start" | "middle" | "end"
> = {
  A: "end",
  B: "middle",
  C: "start",
};

export function commandRangeLabelX(
  channel: ChannelSlot,
  padL: number,
  innerW: number,
): number {
  return padL + innerW * COMMAND_RANGE_LABEL_T[channel];
}

export function formatCommandRangeBoundText(
  channel: ChannelSlot,
  value: number | null | undefined,
  unit: "℃" | "%",
): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (unit === "℃") return `${channel} ${value.toFixed(1)}℃`;
  return `${channel} ${Math.round(value)}%`;
}

/** 측정 Y 도메인 안의 상·하한만 선에 붙인다. 도메인이 없으면 숨기지 않는다. */
export function commandBoundInDomain(
  value: number | null | undefined,
  domain: readonly [number, number] | null | undefined,
): boolean {
  if (value == null || !Number.isFinite(value)) return false;
  if (
    domain == null ||
    !Number.isFinite(domain[0]) ||
    !Number.isFinite(domain[1])
  ) {
    return true;
  }
  const lo = Math.min(domain[0], domain[1]);
  const hi = Math.max(domain[0], domain[1]);
  return value >= lo && value <= hi;
}

export function parseChannelSlotLabel(
  label: string | null | undefined,
): ChannelSlot | null {
  if (!label) return null;
  const t = label.trim();
  if (t === "A" || t === "B" || t === "C") return t;
  const m = /^채널\s*([ABC])$/.exec(t);
  return m ? (m[1] as ChannelSlot) : null;
}

export function focusCommandRangeFrame(
  frame: TrendCommandRangeFrame | null | undefined,
  channel: ChannelSlot | null | undefined,
): TrendCommandRangeFrame | null {
  if (!frame?.channels.length || !channel) return null;
  const channels = frame.channels.filter((c) => c.channel === channel);
  return channels.length > 0 ? { channels } : null;
}

export type CommandMarkerFocus = {
  idx: number;
  channel: ChannelSlot;
  eventMarkId?: string;
};

function isFiniteNum(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

export function buildCommandRangePreview(
  windows: {
    a: FanControlWindow;
    b: FanControlWindow;
    c: FanControlWindow;
  },
  len: number,
  mapTemp: (v: number | null | undefined) => number | null,
  mapMotor: (v: number | null | undefined) => number | null,
  tempVisibleDomain?: readonly [number, number] | null,
  motorVisibleDomain: readonly [number, number] | null = [0, 100],
): TrendCommandRangeFrame[] {
  const winOf: Record<ChannelSlot, FanControlWindow> = {
    A: windows.a,
    B: windows.b,
    C: windows.c,
  };
  const out: TrendCommandRangeFrame[] = [];
  for (let i = 0; i < len; i++) {
    const channels: TrendCommandChannelRange[] = [];
    for (const channel of COMMAND_RANGE_CHANNELS) {
      const w = winOf[channel];
      const loC = w.loC[i] ?? null;
      const hiC = w.hiC[i] ?? null;
      const minVent = w.minVent[i] ?? null;
      const maxVent = w.maxVent[i] ?? null;
      if (
        !isFiniteNum(loC) &&
        !isFiniteNum(hiC) &&
        !isFiniteNum(minVent) &&
        !isFiniteNum(maxVent)
      ) {
        continue;
      }
      channels.push({
        channel,
        tempLo: mapTemp(loC),
        tempHi: mapTemp(hiC),
        motorLo: mapMotor(minVent),
        motorHi: mapMotor(maxVent),
        tempLoText: commandBoundInDomain(loC, tempVisibleDomain)
          ? formatCommandRangeBoundText(channel, loC, "℃")
          : null,
        tempHiText: commandBoundInDomain(hiC, tempVisibleDomain)
          ? formatCommandRangeBoundText(channel, hiC, "℃")
          : null,
        motorLoText: commandBoundInDomain(minVent, motorVisibleDomain)
          ? formatCommandRangeBoundText(channel, minVent, "%")
          : null,
        motorHiText: commandBoundInDomain(maxVent, motorVisibleDomain)
          ? formatCommandRangeBoundText(channel, maxVent, "%")
          : null,
      });
    }
    out.push({ channels });
  }
  return out;
}
