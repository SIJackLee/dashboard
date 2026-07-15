import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseRegMapPayload, type RegMapEntry } from "./kma-wrn-match";

/** 앱·스크립트 공용 REG_ID map (단일 파일). */
export const WRN_REG_ID_MAP_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "wrn-reg-id-map.json",
);

/** Node 스크립트용 — wrn-reg-id-map.json 파일 로드. */
export function loadRegIdMapFromFile(
  path: string = WRN_REG_ID_MAP_PATH,
): RegMapEntry[] {
  return parseRegMapPayload(JSON.parse(readFileSync(path, "utf8")));
}
