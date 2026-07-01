import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const WTHR_WRN_PWN_STATUS =
  "https://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnStatus";

type PwnItem = Record<string, unknown>;

function unwrapItems(body: { items?: { item?: PwnItem | PwnItem[] } }): PwnItem[] {
  const raw = body?.items?.item;
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

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
  const dataGoKey = Deno.env.get("DATA_GO_KR_SERVICE_KEY")?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: config, error: configErr } = await supabase
    .from("iot_decode_config")
    .select("cron_secret")
    .eq("id", 1)
    .single();

  if (configErr || !config?.cron_secret) {
    return json({ error: "config_unavailable", detail: configErr?.message }, 500);
  }

  const auth = req.headers.get("Authorization") ?? "";
  if (auth !== `Bearer ${config.cron_secret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  if (!dataGoKey) {
    await supabase.from("weather_warn_cache").upsert({
      id: 1,
      fetched_at: new Date().toISOString(),
      fetch_ok: false,
      result_code: "no_key",
      result_msg: "DATA_GO_KR_SERVICE_KEY not set on Edge",
      raw_items: [],
      updated_at: new Date().toISOString(),
    });
    return json({ error: "missing_data_go_kr_key" }, 500);
  }

  const search = new URLSearchParams({
    serviceKey: dataGoKey,
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
  });

  const res = await fetch(`${WTHR_WRN_PWN_STATUS}?${search.toString()}`);
  const text = await res.text();

  let fetchOk = false;
  let resultCode = "http_error";
  let resultMsg = text.slice(0, 200);
  let items: PwnItem[] = [];
  let tmFc: number | null = null;

  if (res.ok) {
    try {
      const parsed = JSON.parse(text) as {
        response?: {
          header?: { resultCode?: string; resultMsg?: string };
          body?: { items?: { item?: PwnItem | PwnItem[] } };
        };
      };
      const header = parsed?.response?.header;
      resultCode = header?.resultCode ?? "unknown";
      resultMsg = header?.resultMsg ?? "";
      fetchOk = resultCode === "00";
      items = parsed?.response?.body
        ? unwrapItems(parsed.response.body)
        : [];
      const firstTm = items[0]?.tmFc;
      if (firstTm != null) tmFc = Number(firstTm);
    } catch {
      resultCode = "parse_error";
      resultMsg = text.slice(0, 200);
    }
  }

  const { error: upsertErr } = await supabase.from("weather_warn_cache").upsert({
    id: 1,
    fetched_at: new Date().toISOString(),
    tm_fc: tmFc,
    raw_items: items,
    fetch_ok: fetchOk,
    result_code: resultCode,
    result_msg: resultMsg,
    updated_at: new Date().toISOString(),
  });

  if (upsertErr) {
    return json({ error: "cache_upsert_failed", detail: upsertErr.message }, 500);
  }

  return json({
    ok: fetchOk,
    resultCode,
    itemCount: items.length,
    tmFc,
  });
});
