/**
 * 실행: npx tsx src/lib/farm/barn-plan-enabled.test.ts
 */
import assert from "node:assert/strict";
import { barnPlanEnabled } from "./barn-plan-enabled";

const FLAG = "NEXT_PUBLIC_BARN_PLAN_ENABLED";
const prev = process.env[FLAG];

process.env[FLAG] = "1";
assert.equal(barnPlanEnabled(), true);

process.env[FLAG] = "true";
assert.equal(barnPlanEnabled(), true);

process.env[FLAG] = "0";
assert.equal(barnPlanEnabled(), false);

process.env[FLAG] = "off";
assert.equal(barnPlanEnabled(), false);

if (prev === undefined) delete process.env[FLAG];
else process.env[FLAG] = prev;

console.log("barn-plan-enabled.test.ts: ok");
