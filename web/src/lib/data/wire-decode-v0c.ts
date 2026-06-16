/**
 * v0x0C wire decode — slim row stream (ver + flags + 77B row).
 * Row body identical to v0x0B; see wire-decode-v0b.ts decodeRow().
 */

import { decodeRow, parsePayloadBytea, type DecodedChannel } from "@/lib/data/wire-decode-v0b";

const VER_V0C = 0x0c;
const HEADER_SIZE = 2;
const ROW_SIZE = 77;
const FLAG_HISTORY = 0x01;

export type DecodedV0cPayload = {
  wireVer: number;
  packetMode: "live" | "history";
  history: boolean;
  controllerKey: string;
  eqpmnNo: string;
  stallTyCode: string;
  stallNo: string;
  mesureDt: string;
  channels: DecodedChannel[];
};

export function decodeV0cPayload(wire: Uint8Array): DecodedV0cPayload | null {
  if (wire.length !== HEADER_SIZE + ROW_SIZE + 2) return null;
  if (wire[0] !== VER_V0C) return null;

  const flags = wire[1]!;
  const history = Boolean(flags & FLAG_HISTORY);
  const row = wire.subarray(HEADER_SIZE, HEADER_SIZE + ROW_SIZE);
  if (row.length !== ROW_SIZE) return null;

  const decoded = decodeRow(row);
  return {
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
