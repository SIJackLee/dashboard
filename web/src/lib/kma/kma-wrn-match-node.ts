import { readFileSync } from "node:fs";

import { parseRegMapPayload, type RegMapEntry } from "./kma-wrn-match";

/** Node 스크립트용 — wrn-reg-id-map.json 파일 로드. */
export function loadRegIdMapFromFile(path: string): RegMapEntry[] {
  return parseRegMapPayload(JSON.parse(readFileSync(path, "utf8")));
}
