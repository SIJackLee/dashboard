/** v0x0C wire decode — port of dashboard/web/src/lib/data/wire-decode-v0c.ts */

const VER_V0C = 0x0c;
const HEADER_SIZE = 2;
const ROW_SIZE = 75;
const ROW_SENSOR_TEMPS = 4;
const CHANNEL_BLOCK = 19;
const CHANNEL_LABELS = ["A", "B", "C"] as const;
const NA_TEMP = 0xffff;
const NA_FAN = 0xff;

export type DecodedThermo = {
  setpointTemp: string | null;
  tempDeviation: string | null;
  minVentPct: number | null;
  maxVentPct: number | null;
};

export type DecodedV0cChannel = {
  channel: string;
  eqpmnCode: string;
  outputs: Record<string, string>;
  thermo: DecodedThermo | null;
};

export type DecodedV0cPayload = {
  schema_version: "v0c-1";
  wireVer: number;
  packetMode: "live" | "history";
  history: boolean;
  controllerKey: string;
  eqpmnNo: string;
  stallTyCode: string;
  stallNo: string;
  mesureDt: string;
  runMode: number;
  tempsC: (string | null)[];
  humidityPct: string | null;
  channels: DecodedV0cChannel[];
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
    setpointTemp: sp === NA_TEMP ? null : (sp / 10).toFixed(1),
    tempDeviation: dev === NA_TEMP ? null : (dev / 10).toFixed(1),
    minVentPct: minV === NA_FAN ? null : minV,
    maxVentPct: maxV === NA_FAN ? null : maxV,
  };
}

function decodeChannelBlock(
  block: Uint8Array,
  channel: string,
): DecodedV0cChannel | null {
  if (block.every((b) => b === 0xff)) return null;
  const eqpmnRaw = block[0]!;
  const measMask = readU16LE(block, 1);
  const outputs: Record<string, string> = {};
  for (let sn = 0; sn < 10; sn++) {
    if (!(measMask & (1 << sn))) continue;
    const v = block[3 + sn]!;
    if (v === NA_FAN) continue;
    outputs[String(sn + 1)] = String(v);
  }
  return {
    channel,
    eqpmnCode: formatEqpmnCode(eqpmnRaw),
    outputs,
    thermo: decodeThermo(block, 13),
  };
}

function decodeRow(
  row: Uint8Array,
): Omit<DecodedV0cPayload, "schema_version" | "wireVer" | "packetMode" | "history"> {
  const rowT = readU32LE(row, 0);
  const stallTy = formatStallTy(row[4]!);
  const stallNo = formatStallNo(row[5]!);
  const eqpmnNo = formatEqpmnNo(row[6]!);
  const runMode = row[7]!;
  const tempsC: (string | null)[] = [];
  let off = 8;
  for (let i = 0; i < ROW_SENSOR_TEMPS; i++) {
    tempsC.push(formatSensor(readU16LE(row, off)));
    off += 2;
  }
  const humidityPct = formatSensor(readU16LE(row, off));
  off += 2;

  const channels: DecodedV0cChannel[] = [];
  for (let i = 0; i < 3; i++) {
    const blockOff = off + i * CHANNEL_BLOCK;
    const block = row.subarray(blockOff, blockOff + CHANNEL_BLOCK);
    const ch = decodeChannelBlock(block, CHANNEL_LABELS[i]!);
    if (ch) channels.push(ch);
  }

  return {
    controllerKey: `${stallTy}:${stallNo}:${eqpmnNo}`,
    eqpmnNo,
    stallTyCode: stallTy,
    stallNo,
    mesureDt: formatMesureDt(rowT),
    runMode,
    tempsC,
    humidityPct,
    channels,
  };
}

export function parsePayloadBytea(value: unknown): Uint8Array | null {
  if (value == null) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
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

export function decodeV0cPayload(wire: Uint8Array): DecodedV0cPayload | null {
  if (wire.length !== HEADER_SIZE + ROW_SIZE + 2) return null;
  if (wire[0] !== VER_V0C) return null;

  const flags = wire[1]!;
  const history = Boolean(flags & 0x01);
  const row = wire.subarray(HEADER_SIZE, HEADER_SIZE + ROW_SIZE);
  if (row.length !== ROW_SIZE) return null;

  const decoded = decodeRow(row);
  return {
    schema_version: "v0c-1",
    wireVer: VER_V0C,
    packetMode: history ? "history" : "live",
    history,
    ...decoded,
  };
}

export function decodeV0cPayloadFromDb(
  payloadBytea: unknown,
): DecodedV0cPayload | null {
  const wire = parsePayloadBytea(payloadBytea);
  if (!wire) return null;
  return decodeV0cPayload(wire);
}

export function primaryTempC(tempsC: (string | null)[]): number | null {
  for (const t of tempsC) {
    if (t == null) continue;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function parseOptionalPct(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function fanPctFromChannels(
  channels: DecodedV0cChannel[],
  eqpmnCode: string,
): number | null {
  const ch = channels.find((c) => c.eqpmnCode === eqpmnCode);
  if (!ch?.outputs) return null;
  let max: number | null = null;
  for (const raw of Object.values(ch.outputs)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    max = max == null ? n : Math.max(max, n);
  }
  return max;
}
