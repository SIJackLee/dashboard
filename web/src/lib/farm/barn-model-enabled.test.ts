/**
 * 실행: npx tsx src/lib/farm/barn-model-enabled.test.ts
 */
import assert from "node:assert/strict";
import { barnModelEnabled } from "./barn-model-enabled";

const FLAG = "NEXT_PUBLIC_BARN_MODEL_ENABLED";
const prev = process.env[FLAG];

process.env[FLAG] = "1";
assert.equal(barnModelEnabled(), true);

process.env[FLAG] = "true";
assert.equal(barnModelEnabled(), true);

process.env[FLAG] = "0";
assert.equal(barnModelEnabled(), false);

process.env[FLAG] = "off";
assert.equal(barnModelEnabled(), false);

if (prev === undefined) delete process.env[FLAG];
else process.env[FLAG] = prev;

console.log("barn-model-enabled.test.ts: ok");
