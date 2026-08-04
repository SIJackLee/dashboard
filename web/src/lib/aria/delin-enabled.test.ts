/**
 * 실행: npx tsx src/lib/aria/delin-enabled.test.ts
 */
import assert from "node:assert/strict";
import { delinEnabled } from "./delin-enabled";

const prev = {
  flag: process.env.NEXT_PUBLIC_DELIN_ENABLED,
  vercel: process.env.VERCEL_ENV,
  vercelPub: process.env.NEXT_PUBLIC_VERCEL_ENV,
  node: process.env.NODE_ENV,
};

function restore() {
  for (const [k, v] of Object.entries({
    NEXT_PUBLIC_DELIN_ENABLED: prev.flag,
    VERCEL_ENV: prev.vercel,
    NEXT_PUBLIC_VERCEL_ENV: prev.vercelPub,
    NODE_ENV: prev.node,
  })) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

try {
  process.env.NEXT_PUBLIC_DELIN_ENABLED = "false";
  assert.equal(delinEnabled(), false);

  process.env.NEXT_PUBLIC_DELIN_ENABLED = "true";
  assert.equal(delinEnabled(), true);

  delete process.env.NEXT_PUBLIC_DELIN_ENABLED;
  process.env.NEXT_PUBLIC_VERCEL_ENV = "preview";
  process.env.VERCEL_ENV = "preview";
  assert.equal(delinEnabled(), true);

  process.env.NEXT_PUBLIC_VERCEL_ENV = "production";
  process.env.VERCEL_ENV = "production";
  process.env.NODE_ENV = "production";
  assert.equal(delinEnabled(), false);

  console.log("delin-enabled.test.ts: ok");
} finally {
  restore();
}
