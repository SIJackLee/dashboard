#!/usr/bin/env node
/**
 * Admin RLS 관점 LIVE/overview 조회 — P0 데이터 불일치 진단
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ensureTestPasswords, passwordForEmail } from "./test-accounts.mjs";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anon || !service) throw new Error("Missing Supabase env");

const adminSvc = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});
await ensureTestPasswords(adminSvc);

const userClient = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: signIn, error: signErr } = await userClient.auth.signInWithPassword({
  email: "admin@test.com",
  password: passwordForEmail("admin@test.com"),
});
if (signErr || !signIn.session) throw signErr ?? new Error("login failed");

const token = signIn.session.access_token;
const rls = createClient(url, anon, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { autoRefreshToken: false, persistSession: false },
});

const [overview, listGlobal, listFarm02] = await Promise.all([
  rls.from("v_iot_farm_overview").select("*"),
  rls
    .from("v_iot_dashboard_list")
    .select("controller_key,stall_ty_code,stall_no", { count: "exact" })
    .limit(3),
  rls
    .from("v_iot_dashboard_list")
    .select("controller_key,stall_ty_code,stall_no", { count: "exact" })
    .eq("lsind_regist_no", "FARM02")
    .eq("item_code", "P00")
    .limit(3),
]);

console.log(
  JSON.stringify(
    {
      overviewCount: overview.data?.length ?? 0,
      overviewError: overview.error?.message ?? null,
      listGlobalCount: listGlobal.count,
      listGlobalSample: listGlobal.data,
      listGlobalError: listGlobal.error?.message ?? null,
      listFarm02Count: listFarm02.count,
      listFarm02Sample: listFarm02.data,
      listFarm02Error: listFarm02.error?.message ?? null,
    },
    null,
    2
  )
);
