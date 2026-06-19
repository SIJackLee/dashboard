import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  decodeV0cPayloadFromDb,
  fanPctFromChannels,
  parseOptionalPct,
  primaryTempC,
} from "./wire-decode-v0c.ts";

type RawRow = {
  id: number;
  lsind_regist_no: string;
  item_code: string;
  module_uid: number;
  topic: string | null;
  payload_bytea: unknown;
  received_at: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", Connection: "keep-alive" },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: config, error: configErr } = await supabase
    .from("iot_decode_config")
    .select("cron_secret, batch_limit")
    .eq("id", 1)
    .single();

  if (configErr || !config?.cron_secret) {
    return json({ error: "config_unavailable", detail: configErr?.message }, 500);
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${config.cron_secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const batchLimit = config.batch_limit ?? 100;

  const { data: cursorRow, error: cursorErr } = await supabase
    .from("iot_decode_cursor")
    .select("last_raw_id")
    .eq("id", 1)
    .single();

  if (cursorErr) {
    return json({ error: "cursor_unavailable", detail: cursorErr.message }, 500);
  }

  const lastRawId = cursorRow?.last_raw_id ?? 0;

  const { data: rawRows, error: rawErr } = await supabase
    .from("iot_room_state_raw")
    .select(
      "id, lsind_regist_no, item_code, module_uid, topic, payload_bytea, received_at",
    )
    .gt("id", lastRawId)
    .order("id", { ascending: true })
    .limit(batchLimit);

  if (rawErr) {
    return json({ error: "raw_fetch_failed", detail: rawErr.message }, 500);
  }

  const rows = (rawRows ?? []) as RawRow[];
  if (rows.length === 0) {
    return json({
      ok: true,
      processed: 0,
      decoded: 0,
      skipped: 0,
      failed: 0,
      last_raw_id: lastRawId,
    });
  }

  let decoded = 0;
  let skipped = 0;
  let failed = 0;
  let maxRawId = lastRawId;

  for (const row of rows) {
    maxRawId = row.id;
    const payload = decodeV0cPayloadFromDb(row.payload_bytea);

    if (!payload) {
      skipped += 1;
      continue;
    }

    const decodedJson = payload;
    const insertRow = {
      raw_id: row.id,
      lsind_regist_no: row.lsind_regist_no,
      item_code: row.item_code,
      module_uid: row.module_uid,
      topic: row.topic,
      wire_ver: payload.wireVer,
      packet_mode: payload.packetMode,
      history: payload.history,
      controller_key: payload.controllerKey,
      eqpmn_no: payload.eqpmnNo,
      stall_ty_code: payload.stallTyCode,
      stall_no: payload.stallNo,
      mesure_dt: payload.mesureDt,
      run_mode: payload.runMode,
      temp_c: primaryTempC(payload.tempsC),
      humidity_pct: parseOptionalPct(payload.humidityPct),
      fan_supply_pct: fanPctFromChannels(payload.channels, "EC01"),
      fan_exhaust_pct: fanPctFromChannels(payload.channels, "EC02"),
      fan_intake_pct: fanPctFromChannels(payload.channels, "EC03"),
      decoded_json: decodedJson,
      decode_status: "ok",
      decode_source: "edge",
      received_at: row.received_at,
    };

    const { error: upsertErr } = await supabase
      .from("iot_room_state_decoded")
      .upsert(insertRow, { onConflict: "raw_id" });

    if (upsertErr) {
      failed += 1;
      await supabase.from("iot_room_state_decode_failed").upsert(
        {
          raw_id: row.id,
          wire_ver: payload.wireVer,
          error_code: "UPSERT_FAILED",
          error_detail: upsertErr.message,
          attempted_at: new Date().toISOString(),
        },
        { onConflict: "raw_id" },
      );
      continue;
    }

    decoded += 1;
    await supabase
      .from("iot_room_state_decode_failed")
      .delete()
      .eq("raw_id", row.id);
  }

  const { error: cursorUpdateErr } = await supabase
    .from("iot_decode_cursor")
    .update({
      last_raw_id: maxRawId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (cursorUpdateErr) {
    return json(
      {
        error: "cursor_update_failed",
        detail: cursorUpdateErr.message,
        decoded,
        skipped,
        failed,
      },
      500,
    );
  }

  return json({
    ok: true,
    processed: rows.length,
    decoded,
    skipped,
    failed,
    last_raw_id: maxRawId,
  });
});
