"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchThermoCommandAction,
  type BulkSentCommandItem,
} from "@/app/(dashboard)/controllers/actions";
import {
  resolveThermoSettings,
  thermoFromDecoded,
  thermoValuesMatch,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { ThermoCommand, ThermoCommandStatus } from "@/lib/data/commands";
import type { BarnReading } from "@/lib/data/iot";
import {
  channelBySlot,
  type ChannelSlot,
} from "@/lib/data/iot-channel";

const PENDING_POLL_MS = 2000;
const SENT_POLL_MS = 4000;
const LIVE_POLL_MS = 5000;
const MAX_POLL_MS = 90_000;
const COMPLETE_AUTO_DISMISS_MS = 6500;

const STATUS_RANK: Record<ThermoCommandStatus, number> = {
  pending: 1,
  sent: 2,
  applied: 3,
  failed: 3,
  cancelled: 3,
};

export type BulkLiveTrackRow = {
  key: string;
  id: string;
  command: ThermoCommand;
  liveConfirmed: boolean;
};

export type BulkLiveProgress = {
  total: number;
  ackDone: number;
  liveDone: number;
  failed: number;
  pending: number;
  timedOut: boolean;
  complete: boolean;
  allLive: boolean;
};

type Args = {
  thermoSettings: Record<string, ControllerThermoSettings>;
  readings: BarnReading[];
  /** farm soft refresh / RSC refresh */
  onRefreshLive?: () => void;
};

type ThermoValues = Pick<
  ControllerThermoSettings,
  "setpointTemp" | "tempDeviation" | "minVentPct" | "maxVentPct"
>;

function mergeCommand(
  prev: ThermoCommand,
  next: ThermoCommand | null | undefined,
): ThermoCommand {
  if (!next || next.id !== prev.id) return prev;
  if (STATUS_RANK[next.status] >= STATUS_RANK[prev.status]) return next;
  return prev;
}

function isAckDone(status: ThermoCommandStatus): boolean {
  return status === "sent" || status === "applied";
}

function isTerminalFail(status: ThermoCommandStatus): boolean {
  return status === "failed" || status === "cancelled";
}

/**
 * LIVE uplink 실측값.
 * - 채널 명령: 해당 슬롯만 (A 폴백 금지 — B 조기 완료 오탐 방지)
 * - 레거시(CTRL): A 우선 후 다른 채널·루트 thermo
 */
function liveThermoFromReading(
  r: BarnReading,
  channel?: ChannelSlot | null,
): ThermoValues | null {
  if (r.channels?.length) {
    if (channel) {
      return thermoFromDecoded(
        channelBySlot(r.channels, channel)?.thermo ?? null,
      );
    }
    const chA = channelBySlot(r.channels, "A")?.thermo;
    const fromA = thermoFromDecoded(chA ?? null);
    if (fromA) return fromA;
    for (const ch of r.channels) {
      const parsed = thermoFromDecoded(ch.thermo);
      if (parsed) return parsed;
    }
  }
  return thermoFromDecoded(r.thermo ?? null);
}

function liveCandidatesForReading(
  reading: BarnReading,
  thermoSettings: Record<string, ControllerThermoSettings>,
  channel?: ChannelSlot | null,
): ThermoValues[] {
  const candidates: ThermoValues[] = [];
  const fromReading = liveThermoFromReading(reading, channel);
  if (fromReading) candidates.push(fromReading);

  if (channel) {
    const fromMap = resolveThermoSettings(
      thermoSettings,
      reading.farmKey,
      reading.moduleUid,
      reading.controllerKey,
      channel,
    );
    if (fromMap?.source === "live") candidates.push(fromMap);
  } else {
    const fromMap =
      resolveThermoSettings(
        thermoSettings,
        reading.farmKey,
        reading.moduleUid,
        reading.controllerKey,
        "A",
      ) ??
      resolveThermoSettings(
        thermoSettings,
        reading.farmKey,
        reading.moduleUid,
        reading.controllerKey,
      );
    if (fromMap?.source === "live") candidates.push(fromMap);
  }

  return candidates;
}

export function useBulkCommandPipelineTracker({
  thermoSettings,
  readings,
  onRefreshLive,
}: Args) {
  const [rows, setRows] = useState<BulkLiveTrackRow[]>([]);
  const [active, setActive] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const rowsRef = useRef(rows);
  const onRefreshLiveRef = useRef(onRefreshLive);
  useEffect(() => {
    onRefreshLiveRef.current = onRefreshLive;
  });

  const readingByKey = useMemo(() => {
    const map = new Map<string, BarnReading>();
    for (const r of readings) map.set(r.key, r);
    return map;
  }, [readings]);

  const startSession = useCallback((items: BulkSentCommandItem[]) => {
    if (items.length === 0) {
      setRows([]);
      setActive(false);
      setTimedOut(false);
      setBannerVisible(false);
      startedAtRef.current = null;
      return;
    }
    setRows(
      items.map((item) => ({
        key: item.key,
        id: item.id,
        command: item.command,
        liveConfirmed: false,
      })),
    );
    setActive(true);
    setTimedOut(false);
    setBannerVisible(true);
    startedAtRef.current = Date.now();
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerVisible(false);
    const current = rowsRef.current;
    const settled =
      current.length === 0 ||
      current.every(
        (r) => r.liveConfirmed || isTerminalFail(r.command.status),
      );
    if (settled || timedOut) {
      setActive(false);
      setRows([]);
      startedAtRef.current = null;
    }
  }, [timedOut]);

  const clearSession = useCallback(() => {
    setRows([]);
    setActive(false);
    setTimedOut(false);
    setBannerVisible(false);
    startedAtRef.current = null;
  }, []);

  // LIVE 일치 확인 — reading 디코드 실측 우선 (명령 merge map은 source≠live라 오탐/미탐 방지)
  // effect setState 대신 render-time derive — cascading render 경고 회피
  const trackedRows = useMemo(() => {
    if (!active || rows.length === 0) return rows;
    let changed = false;
    const next = rows.map((row) => {
      if (row.liveConfirmed || isTerminalFail(row.command.status)) return row;
      // pending만 있고 LIVE 이전 설정과 우연히 같으면 오탐 — sent/applied 이후만
      if (row.command.status === "pending") return row;
      const reading = readingByKey.get(row.key);
      if (!reading) return row;
      const matched = liveCandidatesForReading(
        reading,
        thermoSettings,
        row.command.channel,
      ).some((values) => thermoValuesMatch(values, row.command));
      if (!matched) return row;
      changed = true;
      return { ...row, liveConfirmed: true };
    });
    return changed ? next : rows;
  }, [active, readingByKey, thermoSettings, rows]);

  useEffect(() => {
    rowsRef.current = trackedRows;
  });

  const progress = useMemo((): BulkLiveProgress => {
    const total = trackedRows.length;
    let ackDone = 0;
    let liveDone = 0;
    let failed = 0;
    let pending = 0;
    for (const row of trackedRows) {
      if (row.liveConfirmed) liveDone += 1;
      if (isTerminalFail(row.command.status)) failed += 1;
      else if (isAckDone(row.command.status)) ackDone += 1;
      else pending += 1;
    }
    const allLive = total > 0 && liveDone === total;
    const settled =
      total > 0 &&
      trackedRows.every(
        (r) => r.liveConfirmed || isTerminalFail(r.command.status),
      );
    return {
      total,
      ackDone,
      liveDone,
      failed,
      pending,
      timedOut,
      complete: settled || timedOut,
      allLive,
    };
  }, [trackedRows, timedOut]);

  const pollSignature = useMemo(
    () =>
      trackedRows
        .map((r) => `${r.id}:${r.command.status}:${r.liveConfirmed ? 1 : 0}`)
        .join("|"),
    [trackedRows],
  );

  // 폴링 — 명령 status + LIVE refresh
  useEffect(() => {
    if (!active || trackedRows.length === 0) return;

    const openRows = trackedRows.filter(
      (r) => !r.liveConfirmed && !isTerminalFail(r.command.status),
    );
    if (openRows.length === 0) return;

    const anyPending = openRows.some((r) => r.command.status === "pending");
    const anySent = openRows.some((r) => r.command.status === "sent");
    const awaitingLive = openRows.some(
      (r) => r.command.status === "sent" || r.command.status === "applied",
    );
    const intervalMs = anyPending
      ? PENDING_POLL_MS
      : anySent
        ? SENT_POLL_MS
        : awaitingLive
          ? LIVE_POLL_MS
          : null;
    if (!intervalMs) return;

    let cancelled = false;
    const ids = openRows.map((r) => r.id);

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      const started = startedAtRef.current;
      if (started != null && Date.now() - started >= MAX_POLL_MS) {
        setTimedOut(true);
        return;
      }
      const updates = await Promise.all(
        ids.map((id) => fetchThermoCommandAction(id)),
      );
      if (cancelled) return;
      setRows((prev) =>
        prev.map((row) => {
          const fetched = updates.find((u) => u?.id === row.id) ?? null;
          const command = mergeCommand(row.command, fetched);
          return command === row.command ? row : { ...row, command };
        }),
      );
      // pending-only 구간은 명령 status만. LIVE n/N 확인 중일 때만 farm LIVE 갱신
      if (awaitingLive) {
        onRefreshLiveRef.current?.();
      }
    };

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, intervalMs);
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // pollSignature drives restart only when status/live set changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rows captured via signature
  }, [active, pollSignature]);

  // 전원 LIVE 확인 시 배너 자동 닫힘
  useEffect(() => {
    if (!bannerVisible || !progress.allLive) return;
    const id = window.setTimeout(() => {
      setBannerVisible(false);
      setActive(false);
      setRows([]);
      startedAtRef.current = null;
    }, COMPLETE_AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [bannerVisible, progress.allLive]);

  return {
    active,
    bannerVisible,
    rows: trackedRows,
    progress,
    startSession,
    dismissBanner,
    clearSession,
  };
}
