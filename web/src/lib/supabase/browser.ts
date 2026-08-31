"use client";

import { Buffer } from "buffer";
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}

/** 브라우저·Capacitor WebView용 — 쿠키 세션 (SSR 미들웨어와 공유) */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
