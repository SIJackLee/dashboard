"use client";

import { useEffect, useState } from "react";
import { formatReceivedAgo } from "@/lib/data/farm-summaries";

/** 상대 시간 — SSR/CSR 불일치 방지를 위해 클라이언트에서만 계산 */
export function ReceivedAgoText({ iso }: { iso: string | null }) {
  const [label, setLabel] = useState(() => (iso ? "…" : "—"));

  useEffect(() => {
    setLabel(formatReceivedAgo(iso));
    if (!iso) return;
    const timer = window.setInterval(
      () => setLabel(formatReceivedAgo(iso)),
      60_000
    );
    return () => window.clearInterval(timer);
  }, [iso]);

  return <span suppressHydrationWarning>{label}</span>;
}
