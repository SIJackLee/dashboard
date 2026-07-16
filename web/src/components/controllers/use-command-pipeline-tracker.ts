"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchThermoCommandAction } from "@/app/(dashboard)/controllers/actions";
import {
  commandStatusLabel,
  thermoValuesMatch,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { ThermoCommand, ThermoCommandStatus } from "@/lib/data/commands";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import { farmKeyId } from "@/lib/data/farm-key";
import { pipelineDetailMessage } from "@/lib/ui/controller-labels";

/** C.py COMMAND_SLEEP_IDLE(2s)에 맞춘 pending 폴링 */
const PENDING_POLL_MS = 2000;
/** sent → applied uplink ACK 대기 */
const SENT_POLL_MS = 4000;
/** applied 후 LIVE 설정값 일치 확인 */
const LIVE_POLL_MS = 5000;
const MAX_POLL_MS = 90_000;

const STATUS_RANK: Record<ThermoCommandStatus, number> = {
  pending: 1,
  sent: 2,
  applied: 3,
  failed: 3,
  cancelled: 3,
};

/** 사용자가 닫은 「현장 반영 확인」 — remount·알람 저장 후에도 재표시 방지 */
const dismissedLiveOverlayCommandIds = new Set<string>();

function pollIntervalMs(
  status: ThermoCommandStatus,
  awaitingLive: boolean
): number | null {
  if (status === "pending") return PENDING_POLL_MS;
  if (status === "sent") return SENT_POLL_MS;
  if (status === "applied" && awaitingLive) return LIVE_POLL_MS;
  return null;
}

function pickFresherCommand(
  a: ThermoCommand | null,
  b: ThermoCommand | null
): ThermoCommand | null {
  if (!a) return b;
  if (!b) return a;
  if (a.id === b.id) {
    return STATUS_RANK[b.status] >= STATUS_RANK[a.status] ? b : a;
  }
  return a.createdAt >= b.createdAt ? a : b;
}

function findLatestForTarget(
  commands: ThermoCommand[],
  farmKey: { lsindRegistNo: string; itemCode: string } | undefined,
  moduleUid: number | undefined,
  controllerKey: string | undefined,
  hasChannels: boolean,
  activeChannel: ChannelSlot | undefined
): ThermoCommand | null {
  if (!farmKey || moduleUid == null || !controllerKey) return null;
  return (
    commands.find(
      (c) =>
        farmKeyId(c.farmKey) === farmKeyId(farmKey) &&
        c.moduleUid === moduleUid &&
        c.controllerKey === controllerKey &&
        (hasChannels ? c.channel === activeChannel : !c.channel)
    ) ?? null
  );
}

export type CommandPipelineFlash = {
  tone: "ok" | "info" | "error";
  text: string;
};

type TrackerOpts = {
  commands: ThermoCommand[];
  farmKey?: { lsindRegistNo: string; itemCode: string };
  moduleUid?: number;
  controllerKey?: string;
  hasChannels: boolean;
  activeChannel?: ChannelSlot;
  /** LIVE·병합 설정값 — 명령과 일치 시 현장 반영 확인 */
  knownSettings: ControllerThermoSettings | null;
  /** LIVE 디코드 설정 (상세 API) — knownSettings보다 우선 매칭에 사용 */
  liveThermo?: Pick<
    ControllerThermoSettings,
    "setpointTemp" | "tempDeviation" | "minVentPct" | "maxVentPct"
  > | null;
  /** 상세 LIVE 재조회 */
  onRefreshLive?: () => void;
};

/**
 * 1) 적용 API 응답으로 즉시 배너 표시
 * 2) pending→sent→applied 폴링 + 상태 전환 토스트
 * 3) LIVE 설정값 일치 시 「현장 반영 확인」
 */
export function useCommandPipelineTracker(opts: TrackerOpts) {
  const {
    commands,
    farmKey,
    moduleUid,
    controllerKey,
    hasChannels,
    activeChannel,
    knownSettings,
    liveThermo,
    onRefreshLive,
  } = opts;

  const [tracked, setTracked] = useState<ThermoCommand | null>(null);
  const [flash, setFlash] = useState<CommandPipelineFlash | null>(null);
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const prevStatusRef = useRef<ThermoCommandStatus | null>(null);
  const confirmedForIdRef = useRef<string | null>(null);
  const onRefreshLiveRef = useRef(onRefreshLive);
  onRefreshLiveRef.current = onRefreshLive;

  const fromServer = useMemo(
    () =>
      findLatestForTarget(
        commands,
        farmKey,
        moduleUid,
        controllerKey,
        hasChannels,
        activeChannel
      ),
    [
      commands,
      farmKey,
      moduleUid,
      controllerKey,
      hasChannels,
      activeChannel,
    ]
  );

  const command = useMemo(
    () => pickFresherCommand(tracked, fromServer),
    [tracked, fromServer]
  );

  const registerCommand = useCallback((cmd: ThermoCommand) => {
    setTracked(cmd);
    setLiveConfirmed(false);
    confirmedForIdRef.current = null;
    prevStatusRef.current = cmd.status;
    setFlash({
      tone: "info",
      text: pipelineDetailMessage(cmd.status, cmd.errorMsg),
    });
  }, []);

  const clearFlash = useCallback(() => setFlash(null), []);

  const isCommandOverlayDismissed = useCallback(
    (commandId: string | undefined) =>
      commandId != null && dismissedLiveOverlayCommandIds.has(commandId),
    []
  );

  const acknowledgeCommandOverlay = useCallback(
    (commandId: string) => {
      dismissedLiveOverlayCommandIds.add(commandId);
      setFlash(null);
    },
    []
  );

  // 컨트롤러·채널 전환 시 추적 초기화
  useEffect(() => {
    setTracked(null);
    setFlash(null);
    setLiveConfirmed(false);
    prevStatusRef.current = null;
    confirmedForIdRef.current = null;
  }, [controllerKey, activeChannel, moduleUid, farmKey?.lsindRegistNo]);

  // 서버 props가 추적 명령을 따라잡으면 병합
  useEffect(() => {
    if (!tracked || !fromServer) return;
    if (fromServer.id !== tracked.id) {
      if (fromServer.createdAt >= tracked.createdAt) {
        setTracked(fromServer);
      }
      return;
    }
    if (STATUS_RANK[fromServer.status] > STATUS_RANK[tracked.status]) {
      setTracked(fromServer);
    }
  }, [fromServer, tracked]);

  // 상태 전환 토스트
  useEffect(() => {
    if (!command) return;
    const prev = prevStatusRef.current;
    if (prev != null && prev !== command.status) {
      const label = commandStatusLabel(command.status);
      const detail = pipelineDetailMessage(command.status, command.errorMsg);
      setFlash({
        tone:
          command.status === "failed"
            ? "error"
            : command.status === "applied"
              ? "ok"
              : "info",
        text: detail ? `${label} — ${detail}` : label,
      });
    }
    prevStatusRef.current = command.status;
  }, [command]);

  // LIVE 현장 반영 확인
  useEffect(() => {
    if (!command) {
      setLiveConfirmed(false);
      return;
    }
    if (command.status === "failed" || command.status === "cancelled") {
      setLiveConfirmed(false);
      return;
    }
    if (confirmedForIdRef.current === command.id) return;
    if (dismissedLiveOverlayCommandIds.has(command.id)) {
      confirmedForIdRef.current = command.id;
      return;
    }

    const candidates = [liveThermo, knownSettings].filter(
      Boolean
    ) as Pick<
      ControllerThermoSettings,
      "setpointTemp" | "tempDeviation" | "minVentPct" | "maxVentPct"
    >[];

    const matched = candidates.some((values) =>
      thermoValuesMatch(values, command)
    );
    if (!matched) return;

    // pending만 있고 LIVE 이전 설정과 우연히 같으면 오탐 — sent/applied 이후만 인정
    if (command.status === "pending") return;

    confirmedForIdRef.current = command.id;
    setLiveConfirmed(true);
    setFlash({
      tone: "ok",
      text: `현장 반영 확인 — LIVE 설정온도 ${command.setpointTemp}℃가 명령과 일치합니다.`,
    });
  }, [command, knownSettings, liveThermo]);

  const awaitingLive =
    Boolean(command) &&
    !liveConfirmed &&
    (command?.status === "sent" || command?.status === "applied");

  // 단건 폴링 + RSC/LIVE 갱신 (백그라운드 탭에서는 중단)
  useEffect(() => {
    if (!command?.id) return;
    const intervalMs = pollIntervalMs(command.status, awaitingLive);
    if (!intervalMs) return;

    const commandId = command.id;
    const deadline = Date.now() + MAX_POLL_MS;
    let cancelled = false;

    const tick = async () => {
      if (cancelled || Date.now() >= deadline) return;
      // 숨겨진 탭에서는 네트워크/리프레시 생략 → 복귀 시 재개
      if (typeof document !== "undefined" && document.hidden) return;
      const next = await fetchThermoCommandAction(commandId);
      if (cancelled) return;
      if (next) {
        setTracked((prev) => pickFresherCommand(prev, next));
      }
      onRefreshLiveRef.current?.();
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, intervalMs);

    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [command?.id, command?.status, awaitingLive]);

  return {
    command,
    registerCommand,
    flash,
    clearFlash,
    liveConfirmed,
    isCommandOverlayDismissed,
    acknowledgeCommandOverlay,
  };
}
