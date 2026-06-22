"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ThermoCommandStatus } from "@/lib/data/commands";

/** C.py COMMAND_SLEEP_IDLE(2s)에 맞춘 pending 폴링 */
const PENDING_POLL_MS = 2000;
/** sent → applied uplink ACK 대기 */
const SENT_POLL_MS = 8000;
const MAX_POLL_MS = 60_000;

function pollIntervalMs(status: ThermoCommandStatus): number | null {
  if (status === "pending") return PENDING_POLL_MS;
  if (status === "sent") return SENT_POLL_MS;
  return null;
}

/** pending/sent 명령 배너 — C.py·ACK 상태 갱신까지 router.refresh 폴링 */
export function useCommandPipelineRefresh(
  status: ThermoCommandStatus | undefined,
  commandId: string | undefined
) {
  const router = useRouter();
  const deadlineRef = useRef(0);

  useEffect(() => {
    const intervalMs = status ? pollIntervalMs(status) : null;
    if (!intervalMs || !commandId) return;

    deadlineRef.current = Date.now() + MAX_POLL_MS;

    const tick = () => {
      if (Date.now() >= deadlineRef.current) return true;
      router.refresh();
      return false;
    };

    const id = window.setInterval(() => {
      if (tick()) window.clearInterval(id);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [status, commandId, router]);
}
