/**
 * 실행: npx tsx src/lib/farm/barn-plan-enabled.test.ts
 */
import assert from "node:assert/strict";
import { barnPlanEnabled } from "./barn-plan-enabled";

const prev = {
  flag: process.env.NEXT_PUBLIC_BARN_PLAN_ENABLED,
  vercel: process.env.VERCEL_ENV,
  vercelPub: process.env.NEXT_PUBLIC_VERCEL_ENV,
  node: process.env.NODE_ENV,
};

function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

function restore() {
  for (const [k, v] of Object.entries({
    NEXT_PUBLIC_BARN_PLAN_ENABLED: prev.flag,
    VERCEL_ENV: prev.vercel,
    NEXT_PUBLIC_VERCEL_ENV: prev.vercelPub,
  })) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  setNodeEnv(prev.node);
}

function productionEnv() {
  delete process.env.NEXT_PUBLIC_BARN_PLAN_ENABLED;
  process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
  process.env.VERCEL_ENV = "production";
  setNodeEnv("production");
}

try {
  process.env.NEXT_PUBLIC_BARN_PLAN_ENABLED = "false";
  assert.equal(barnPlanEnabled(), false);
  assert.equal(barnPlanEnabled({ isAdmin: true }), false);

  process.env.NEXT_PUBLIC_BARN_PLAN_ENABLED = "true";
  assert.equal(barnPlanEnabled(), true);
  assert.equal(barnPlanEnabled({ isAdmin: false }), true);

  delete process.env.NEXT_PUBLIC_BARN_PLAN_ENABLED;
  process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
  process.env.VERCEL_ENV = "preview";
  assert.equal(barnPlanEnabled(), true);
  assert.equal(barnPlanEnabled({ isAdmin: false }), true);

  productionEnv();
  assert.equal(barnPlanEnabled(), false);
  assert.equal(barnPlanEnabled({ isAdmin: false }), false);
  assert.equal(barnPlanEnabled({ isAdmin: true }), true);

  productionEnv();
  process.env.NEXT_PUBLIC_BARN_PLAN_ENABLED = "false";
  assert.equal(barnPlanEnabled({ isAdmin: true }), false);

  delete process.env.NEXT_PUBLIC_BARN_PLAN_ENABLED;
  delete process.env.NEXT_PUBLIC_VERCEL_ENV;
  delete process.env.VERCEL_ENV;
  setNodeEnv("development");
  assert.equal(barnPlanEnabled(), true);
  assert.equal(barnPlanEnabled({ isAdmin: false }), true);

  console.log("barn-plan-enabled.test.ts: ok");
} finally {
  restore();
}
