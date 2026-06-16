import type { DecodedControllerPayload } from "@/lib/data/wire-decode-v0b";
import { decodeV0bPayloadFromDb } from "@/lib/data/wire-decode-v0b";
import { decodeV0cPayloadFromDb } from "@/lib/data/wire-decode-v0c";

/** Decode LIVE uplink: v0x0C first, then legacy v0x0B. */
export function decodeLivePayloadFromDb(
  payloadBytea: unknown,
): DecodedControllerPayload | null {
  const v0c = decodeV0cPayloadFromDb(payloadBytea);
  if (v0c) {
    return {
      wireVer: v0c.wireVer,
      packetMode: v0c.packetMode === "history" ? "history" : "live",
      sessionId: null,
      chunkSeq: 0,
      partial: false,
      lastChunk: true,
      controllerKey: v0c.controllerKey,
      eqpmnNo: v0c.eqpmnNo,
      stallTyCode: v0c.stallTyCode,
      stallNo: v0c.stallNo,
      mesureDt: v0c.mesureDt,
      channels: v0c.channels,
    };
  }
  return decodeV0bPayloadFromDb(payloadBytea);
}
