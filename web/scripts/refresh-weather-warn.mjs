#!/usr/bin/env node
/**
 * Dev: getPwnStatus → weather_warn_cache upsert (service role)
 * Usage: node scripts/refresh-weather-warn.mjs
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { fetchPwnStatus } from "./kma/kma-api-client.mjs";

dotenv.config({
  path: join(dirname(fileURLToPath(import.meta.url)), "../.env.local"),
});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dataGoKey = process.env.DATA_GO_KR_SERVICE_KEY?.trim();

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(1);
}
if (!dataGoKey) {
  console.error("DATA_GO_KR_SERVICE_KEY required");
  process.exit(1);
}

const supabase = createClient(url, serviceKey);
const result = await fetchPwnStatus(dataGoKey);
const tmFc = result.items[0]?.tmFc ?? null;

const { error } = await supabase.from("weather_warn_cache").upsert({
  id: 1,
  fetched_at: new Date().toISOString(),
  tm_fc: tmFc != null ? Number(tmFc) : null,
  raw_items: result.items,
  fetch_ok: result.ok,
  result_code: result.resultCode,
  result_msg: result.resultMsg,
  updated_at: new Date().toISOString(),
});

if (error) {
  console.error("upsert failed:", error.message);
  process.exit(1);
}

console.log(
  `weather_warn_cache updated — ok=${result.ok} items=${result.items.length} code=${result.resultCode}`
);
