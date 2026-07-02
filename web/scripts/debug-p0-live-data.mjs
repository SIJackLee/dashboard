#!/usr/bin/env node
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const sb = createClient(url, key);

const overview = await sb.from("v_iot_farm_overview").select("*");
const farm02 = await sb
  .from("v_iot_dashboard_list")
  .select("controller_key,stall_ty_code,stall_no,eqpmn_no,packet_mode,temp_c")
  .eq("lsind_regist_no", "FARM02")
  .eq("item_code", "P00")
  .limit(8);
const globalCount = await sb
  .from("v_iot_dashboard_list")
  .select("*", { count: "exact", head: true });

console.log(
  JSON.stringify(
    {
      overviewRows: overview.data?.length ?? 0,
      overviewError: overview.error?.message ?? null,
      overviewSample: overview.data?.[0] ?? null,
      globalListCount: globalCount.count,
      farm02Sample: farm02.data ?? [],
      farm02Error: farm02.error?.message ?? null,
    },
    null,
    2
  )
);
