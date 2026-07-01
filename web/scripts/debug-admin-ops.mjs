import dotenv from "dotenv";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ensureTestPasswords, passwordForEmail } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const BASE = process.env.UI_VERIFY_BASE ?? "http://localhost:3000";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
await ensureTestPasswords(adminClient);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/login`);
await page.locator("#email").fill("admin@test.com");
await page.locator("#password").fill(passwordForEmail("admin@test.com"));
await page.locator('button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
await page.goto(`${BASE}/farm?tab=ops`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);

const info = await page.evaluate(() => ({
  url: location.href,
  auditCount: document.querySelectorAll('[data-audit-region="ops-controller-panel"]').length,
  bodySnippet: (document.body.innerText || "").slice(0, 1200),
  hasTemp: (document.body.innerText || "").includes("온도"),
  hasPlaceholder: (document.body.innerText || "").includes("펼친 뒤 선택"),
}));

console.log(JSON.stringify(info, null, 2));
await browser.close();
