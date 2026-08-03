import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5";

type OutboxRow = {
  id: string;
  fcm_token: string;
  payload: {
    title?: string;
    body?: string;
    alarmId?: string;
    lsind?: string;
    itemCode?: string | null;
    farmName?: string | null;
    href?: string;
  } | null;
  attempts: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", Connection: "keep-alive" },
  });

/** Dashboard Secrets에 붙여넣은 PEM/JSON을 jose importPKCS8용으로 정규화 */
function normalizePrivateKey(raw: string): string {
  let s = raw.trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  if (s.startsWith("{")) {
    try {
      const parsed = JSON.parse(s) as { private_key?: string };
      if (typeof parsed.private_key === "string") s = parsed.private_key;
    } catch {
      /* keep s */
    }
  }
  s = s.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim();

  if (!s.includes("BEGIN")) {
    const body = s.replace(/\s+/g, "");
    const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
    return `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----`;
  }

  const match = s.match(
    /-----BEGIN ([^-]+)-----([\s\S]*?)-----END \1-----/,
  );
  if (!match) return s;

  const type = match[1].trim();
  const body = match[2].replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN ${type}-----\n${lines}\n-----END ${type}-----`;
}

async function getFcmAccessToken(
  clientEmail: string,
  privateKeyPem: string,
): Promise<string> {
  const key = await importPKCS8(normalizePrivateKey(privateKeyPem), "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(clientEmail)
    .setSubject(clientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fcm_token_exchange_failed:${res.status}:${text}`);
  }

  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("fcm_token_missing");
  }
  return body.access_token;
}

async function sendFcm(
  projectId: string,
  accessToken: string,
  token: string,
  payload: OutboxRow["payload"],
): Promise<{ ok: true } | { ok: false; unregistered: boolean; error: string }> {
  const title = payload?.title ?? "모듈 알람";
  const body = payload?.body ?? "모듈 이상";
  const data: Record<string, string> = {
    alarmId: payload?.alarmId ?? "",
    lsind: payload?.lsind ?? "",
    itemCode: payload?.itemCode ?? "",
    href: payload?.href ?? "/farm",
  };

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data,
          android: {
            priority: "HIGH",
            notification: {
              defaultSound: true,
            },
          },
        },
      }),
    },
  );

  if (res.ok) return { ok: true };

  const text = await res.text();
  let unregistered = false;
  try {
    const errJson = JSON.parse(text) as {
      error?: { details?: Array<{ errorCode?: string }>; status?: string };
    };
    const codes = (errJson.error?.details ?? [])
      .map((d) => d.errorCode)
      .filter(Boolean);
    unregistered =
      codes.includes("UNREGISTERED") ||
      errJson.error?.status === "NOT_FOUND" ||
      text.includes("UNREGISTERED");
  } catch {
    unregistered = text.includes("UNREGISTERED");
  }

  return { ok: false, unregistered, error: `${res.status}:${text}` };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  let fcmProjectId = Deno.env.get("FCM_PROJECT_ID") ?? "";
  let fcmClientEmail = Deno.env.get("FCM_CLIENT_EMAIL") ?? "";
  let fcmPrivateKey = Deno.env.get("FCM_PRIVATE_KEY") ?? "";

  const saRaw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")?.trim();
  if (saRaw) {
    try {
      const sa = JSON.parse(saRaw) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (sa.project_id) fcmProjectId = sa.project_id;
      if (sa.client_email) fcmClientEmail = sa.client_email;
      if (sa.private_key) fcmPrivateKey = sa.private_key;
    } catch (e) {
      return json(
        {
          error: "invalid_fcm_service_account_json",
          detail: e instanceof Error ? e.message : String(e),
        },
        500,
      );
    }
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }
  if (!fcmProjectId || !fcmClientEmail || !fcmPrivateKey) {
    return json({ error: "missing_fcm_env" }, 500);
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

  const batchLimit = Math.min(config.batch_limit ?? 50, 100);

  let accessToken: string;
  try {
    accessToken = await getFcmAccessToken(fcmClientEmail, fcmPrivateKey);
  } catch (e) {
    return json(
      { error: "fcm_auth_failed", detail: e instanceof Error ? e.message : String(e) },
      500,
    );
  }

  const { data: rows, error: fetchErr } = await supabase
    .from("push_outbox")
    .select("id, fcm_token, payload, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchLimit);

  if (fetchErr) {
    return json({ error: "outbox_fetch_failed", detail: fetchErr.message }, 500);
  }

  const pending = (rows ?? []) as OutboxRow[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let tokensRemoved = 0;

  for (const row of pending) {
    const result = await sendFcm(
      fcmProjectId,
      accessToken,
      row.fcm_token,
      row.payload,
    );

    if (result.ok) {
      const { error } = await supabase
        .from("push_outbox")
        .update({
          status: "sent",
          attempts: row.attempts + 1,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", row.id);
      if (error) {
        failed += 1;
        continue;
      }
      sent += 1;
      continue;
    }

    if (result.unregistered) {
      await supabase
        .from("user_push_device")
        .delete()
        .eq("fcm_token", row.fcm_token);
      tokensRemoved += 1;

      await supabase
        .from("push_outbox")
        .update({
          status: "skipped",
          attempts: row.attempts + 1,
          last_error: result.error,
        })
        .eq("id", row.id);
      skipped += 1;
      continue;
    }

    await supabase
      .from("push_outbox")
      .update({
        status: row.attempts + 1 >= 5 ? "failed" : "pending",
        attempts: row.attempts + 1,
        last_error: result.error,
      })
      .eq("id", row.id);
    failed += 1;
  }

  return json({
    ok: true,
    processed: pending.length,
    sent,
    failed,
    skipped,
    tokensRemoved,
  });
});
