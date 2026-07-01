#!/usr/bin/env node
/**
 * 테스트 계정 비밀번호를 scripts/test-accounts.mjs 정의대로 Supabase에 반영.
 * Usage: node scripts/set-test-passwords.mjs
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ensureTestPasswords, TEST_ACCOUNTS } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local");
    process.exit(1);
  }

  console.log("Target passwords:");
  for (const [role, { email, password }] of Object.entries(TEST_ACCOUNTS)) {
    console.log(`  ${role}: ${email} / ${password}`);
  }

  const adminClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await ensureTestPasswords(adminClient);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
