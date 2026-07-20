/**
 * command-pipeline-id-ttl — Map TTL 만료.
 * Run: npx tsx scripts/assert-command-pipeline-id-ttl.ts
 */
import {
  COMMAND_PIPELINE_ID_TTL_MS,
  addTimedId,
  hasTimedId,
  pruneExpiredTimedIds,
} from "../src/lib/controllers/command-pipeline-id-ttl";

const map = new Map<string, number>();
const t0 = 1_000_000;

addTimedId(map, "a", COMMAND_PIPELINE_ID_TTL_MS, t0);
addTimedId(map, "b", COMMAND_PIPELINE_ID_TTL_MS, t0 + 1000);

if (!hasTimedId(map, "a", COMMAND_PIPELINE_ID_TTL_MS, t0 + 1000)) {
  throw new Error("fresh id should hit");
}
if (hasTimedId(map, "a", COMMAND_PIPELINE_ID_TTL_MS, t0 + COMMAND_PIPELINE_ID_TTL_MS + 1)) {
  throw new Error("expired id should miss");
}
if (map.has("a")) {
  throw new Error("expired id should be deleted on hasTimedId");
}

addTimedId(map, "c", COMMAND_PIPELINE_ID_TTL_MS, t0);
pruneExpiredTimedIds(map, COMMAND_PIPELINE_ID_TTL_MS, t0 + COMMAND_PIPELINE_ID_TTL_MS + 1);
if (map.has("c")) {
  throw new Error("prune should clear expired c");
}
if (!map.has("b")) {
  throw new Error("b should still be within TTL window");
}
pruneExpiredTimedIds(map, COMMAND_PIPELINE_ID_TTL_MS, t0 + 1000 + COMMAND_PIPELINE_ID_TTL_MS + 1);
if (map.has("b")) {
  throw new Error("prune should clear expired b");
}

console.log("assert-command-pipeline-id-ttl: ok");
