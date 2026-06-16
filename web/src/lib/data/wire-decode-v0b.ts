/**
 * v0x0B wire decode for LIVE row-stream (n=1..26 per packet).
 * Mirrors RSD/wire_decode.py — server-side View decode interim.
 */

const VER_V0B = 0x0b;
const HEADER_SIZE = 12;
const ROW_SIZE = 77;
const CHANNEL_BLOCK = 23;
const CHANNEL_LABELS = ["A", "B", "C"] as const;
const NA_TEMP = 0xffff;
const NA_FAN = 0xff;

export type DecodedThermo = {
  setpointTemp: string | null;
  tempDeviation: string | null;
  minVentPct: number | null;
  maxVentPct: number | null;
};

export type DecodedChannel = {
  channel: string;
  eqpmnCode: string;
  tempC: string | null;
  humidityPct: string | null;
  outputs: Record<string, string>;
  thermo: DecodedThermo | null;
};

export type DecodedControllerPayload = {
  wireVer: number;
  packetMode: "live" | "history";
  sessionId: number | null;
  chunkSeq: number;
  partial: boolean;
  lastChunk: boolean;
  controllerKey: string;
  eqpmnNo: string;
  stallTyCode: string;
  stallNo: string;
  mesureDt: string;
  channels: DecodedChannel[];
};

function readU16LE(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8);
}

function readU32LE(buf: Uint8Array, off: number): number {
  return (
    buf[off]! |
    (buf[off + 1]! << 8) |
    (buf[off + 2]! << 16) |
    (buf[off + 3]! << 24)
  ) >>> 0;
}

function formatSensor(raw: number): string | null {
  if (raw === NA_TEMP || raw === 0) return null;
  return (raw / 10).toFixed(1);
}

function formatThermoX10(raw: number): string | null {
  if (raw === NA_TEMP) return null;
  return (raw / 10).toFixed(1);
}

function formatStallTy(raw: number): string {
  return `SP${String(raw).padStart(2, "0")}`;
}

function formatStallNo(raw: number): string {
  return String(raw).padStart(2, "0");
}

function formatEqpmnNo(raw: number): string {
  return String(raw).padStart(2, "0");
}

function formatEqpmnCode(raw: number): string {
  return `EC${String(raw).padStart(2, "0")}`;
}

function formatMesureDt(epochSec: number): string {
  const d = new Date(epochSec * 1000);
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return fmt.format(d).replace("T", " ");
}

function decodeThermo(block: Uint8Array, off: number): DecodedThermo | null {
  const sp = readU16LE(block, off);
  const dev = readU16LE(block, off + 2);
  const minV = block[off + 4]!;
  const maxV = block[off + 5]!;
  if (sp === NA_TEMP && dev === NA_TEMP && minV === NA_FAN && maxV === NA_FAN) {
    return null;
  }
  return {
    setpointTemp: formatThermoX10(sp),
    tempDeviation: formatThermoX10(dev),
    minVentPct: minV === NA_FAN ? null : minV,
    maxVentPct: maxV === NA_FAN ? null : maxV,
  };
}

function decodeChannelBlock(
  block: Uint8Array,
  channel: string,
  active: boolean
): DecodedChannel | null {
  if (!active || block.every((b) => b === 0xff)) return null;
  const temp = readU16LE(block, 0);
  const hum = readU16LE(block, 2);
  const eqpmnRaw = block[4]!;
  const measMask = readU16LE(block, 5);
  const outputs: Record<string, string> = {};
  for (let sn = 0; sn < 10; sn++) {
    if (!(measMask & (1 << sn))) continue;
    const v = block[7 + sn]!;
    if (v === NA_FAN) continue;
    outputs[String(sn + 1)] = String(v);
  }
  return {
    channel,
    eqpmnCode: formatEqpmnCode(eqpmnRaw),
    tempC: formatSensor(temp),
    humidityPct: formatSensor(hum),
    outputs,
    thermo: decodeThermo(block, 17),
  };
}

function decodeRow(row: Uint8Array): Omit<
  DecodedControllerPayload,
  "wireVer" | "packetMode" | "sessionId" | "chunkSeq" | "partial" | "lastChunk"
> {
  const rowT = readU32LE(row, 0);
  const stallTy = formatStallTy(row[4]!);
  const stallNo = formatStallNo(row[5]!);
  const eqpmnNo = formatEqpmnNo(row[6]!);
  const chMask = row[7]! & 0x07;
  const controllerKey = `${stallTy}:${stallNo}:${eqpmnNo}`;
  const channels: DecodedChannel[] = [];
  for (let i = 0; i < 3; i++) {
    const off = 8 + i * CHANNEL_BLOCK;
    const block = row.subarray(off, off + CHANNEL_BLOCK);
    const ch = decodeChannelBlock(block, CHANNEL_LABELS[i]!, Boolean(chMask & (1 << i)));
    if (ch) channels.push(ch);
  }
  return {
    controllerKey,
    eqpmnNo,
    stallTyCode: stallTy,
    stallNo,
    mesureDt: formatMesureDt(rowT),
    channels,
  };
}

export function parsePayloadBytea(value: unknown): Uint8Array | null {
  if (value == null) return null;
  if (value instanceof Uint8Array) return value;
  const text = String(value).trim();
  if (!text) return null;
  const hex = text.startsWith("\\x") ? text.slice(2) : text;
  if (hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** Decode first row in a v0x0B packet (supports n=1 row-stream). */
export function decodeV0bPayload(wire: Uint8Array): DecodedControllerPayload | null {
  if (wire.length < HEADER_SIZE + ROW_SIZE + 2) return null;
  if (wire[0] !== VER_V0B) return null;

  const flags = wire[1]!;
  const sessionId = readU32LE(wire, 2);
  const n = wire[6]!;
  const chunkSeq = readU16LE(wire, 7);
  if (n < 1) return null;

  const history = Boolean(flags & 0x04);
  const rowOff = HEADER_SIZE;
  const row = wire.subarray(rowOff, rowOff + ROW_SIZE);
  if (row.length !== ROW_SIZE) return null;

  const decoded = decodeRow(row);
  return {
    wireVer: VER_V0B,
    packetMode: history ? "history" : "live",
    sessionId,
    chunkSeq,
    partial: Boolean(flags & 0x01),
    lastChunk: Boolean(flags & 0x02),
    ...decoded,
  };
}

export function decodeV0bPayloadFromDb(payloadBytea: unknown): DecodedControllerPayload | null {
  const wire = parsePayloadBytea(payloadBytea);
  if (!wire) return null;
  return decodeV0bPayload(wire);
}
