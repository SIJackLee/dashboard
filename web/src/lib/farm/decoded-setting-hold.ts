import { CHANNEL_SLOT_LABELS } from "@/lib/data/iot-channel";
import type { TrendEventMark } from "@/lib/data/trend-chart-types";
import { formatKst } from "@/lib/datetime/kst";
import { formatTempDisplay, formatVentDisplay } from "@/lib/farm/command-confirm";
import { commandHoldRowIndex } from "@/lib/farm/command-hold-bands";
import type { DecodedSettingHoldSeg } from "@/lib/farm/channel-thermo";

function ventLabel(lo: number | null, hi: number | null): string {
  if (lo == null || hi == null || !Number.isFinite(lo) || !Number.isFinite(hi)) {
    return "—";
  }
  return `${formatVentDisplay(lo).replace("%", "")}–${formatVentDisplay(hi)}`;
}

/** decoded 유지 구간 → 호버 카드. 값은 RPC 설정(절대 ℃ 창). */
export function decodedSettingHoldToEventMark(
  seg: DecodedSettingHoldSeg,
): TrendEventMark {
  const channelLabel = CHANNEL_SLOT_LABELS[seg.channel];
  const atIso = new Date(seg.x0Ms).toISOString();
  const time = formatKst(atIso, "short");
  const dev = Math.max(0, seg.tempHi - seg.tempLo);
  return {
    id: `decoded:${seg.channel}:${seg.i0}:${seg.x0Ms}`,
    atMs: seg.x0Ms,
    row: commandHoldRowIndex(seg.channel) ?? 0,
    tone: "ok",
    ariaLabel: `${time} ${channelLabel}`,
    markerLabel: seg.channel,
    hold: {
      channel: seg.channel,
      tempLo: seg.tempLo,
      tempHi: seg.tempHi,
      ventLo: seg.ventLo,
      ventHi: seg.ventHi,
    },
    card: {
      badge: "설정",
      time,
      hero: channelLabel,
      heroTone: "ok",
      rows: [
        { label: "설정온도", value: formatTempDisplay(seg.tempLo) },
        { label: "편차", value: `±${formatTempDisplay(dev)}` },
        { label: "환기", value: ventLabel(seg.ventLo, seg.ventHi) },
      ],
    },
  };
}
