import type { ThermoCommandStatus } from "@/lib/data/commands";
import { formatOrdinalNo } from "@/lib/farm/command-confirm";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";

/** 적용 큐가 보여주는 최근 창. 통합 추이는 최근 ~1시간을 점으로 읽기 어렵다. */
export const APPLY_QUEUE_WINDOW_MS = 60 * 60 * 1000;
/** 방금 보낸 명령이 이력에 안 잡혀도 큐에 잠시 남김 */
export const APPLY_QUEUE_START_GRACE_MS = 8_000;

export const APPLY_QUEUE_STAGES = ["접수", "전송", "수신", "확인"] as const;
export type ApplyQueueStage = (typeof APPLY_QUEUE_STAGES)[number] | "실패";

export type ApplyQueueTicket = {
  status: ThermoCommandStatus;
  liveConfirmed: boolean;
};

export type ApplyQueueGauge = {
  filled: number;
  current: number;
  rest: number;
  fail: boolean;
};

export type ApplyQueueTargetParts = {
  stall: string;
  unit: string;
  channel: string | null;
};

export function applyQueueStage(ticket: ApplyQueueTicket): ApplyQueueStage {
  if (ticket.status === "failed" || ticket.status === "cancelled") return "실패";
  if (ticket.liveConfirmed) return "확인";
  if (ticket.status === "applied") return "수신";
  if (ticket.status === "sent") return "전송";
  return "접수";
}

export function applyQueueGauge(ticket: ApplyQueueTicket): ApplyQueueGauge {
  const stage = applyQueueStage(ticket);
  if (stage === "실패") {
    return { filled: 0, current: 1, rest: 3, fail: true };
  }
  if (stage === "확인") {
    return { filled: 4, current: 0, rest: 0, fail: false };
  }
  const currentIndex =
    stage === "접수" ? 1 : stage === "전송" ? 2 : 3;
  return {
    filled: currentIndex - 1,
    current: 1,
    rest: 4 - currentIndex,
    fail: false,
  };
}

export function applyQueueShouldAutoCollapse(
  tickets: ApplyQueueTicket[],
  timedOut: boolean,
): boolean {
  if (timedOut || tickets.length === 0) return false;
  return tickets.every((ticket) => applyQueueStage(ticket) === "확인");
}

export function applyQueueHandleLabel(tickets: ApplyQueueTicket[]): string {
  const n = tickets.length;
  if (n === 0) return "적용 큐 · 최근 1시간";
  const failed = tickets.filter((t) => applyQueueStage(t) === "실패").length;
  if (failed > 0) return `적용 ${n} · 실패 ${failed}`;
  const stuck = tickets.find((t) => applyQueueStage(t) !== "확인");
  if (stuck) return `적용 ${n} · ${applyQueueStage(stuck)}`;
  return `적용 ${n} · 확인`;
}

export function applyQueueStageCounts(tickets: ApplyQueueTicket[]) {
  const counts = { 접수: 0, 전송: 0, 수신: 0, 확인: 0, 실패: 0 };
  for (const ticket of tickets) {
    counts[applyQueueStage(ticket)] += 1;
  }
  return counts;
}

export function formatApplyQueueTargetParts(opts: {
  stallTyCode?: string | null;
  stallNo?: string | null;
  eqpmnNo?: string | null;
  channel?: ChannelSlot | null;
}): ApplyQueueTargetParts {
  const typeLabel = formatStallTypeLabel(opts.stallTyCode);
  const stallNo = formatOrdinalNo(opts.stallNo);
  const ctrlNo = formatOrdinalNo(opts.eqpmnNo);
  return {
    stall: stallNo ? `${typeLabel} ${stallNo}번 축사` : typeLabel,
    unit: ctrlNo ? `${ctrlNo}번 컨트롤러` : "컨트롤러",
    channel: opts.channel ? `채널 ${opts.channel}` : null,
  };
}

export function formatApplyQueueTargetLine(opts: {
  stallTyCode?: string | null;
  stallNo?: string | null;
  eqpmnNo?: string | null;
  channel?: ChannelSlot | null;
}): string {
  const parts = formatApplyQueueTargetParts(opts);
  return [parts.stall, parts.unit, parts.channel].filter(Boolean).join(" · ");
}

export function applyQueueStep(ticket: ApplyQueueTicket): number {
  const stage = applyQueueStage(ticket);
  if (stage === "확인") return 4;
  if (stage === "수신") return 3;
  if (stage === "전송") return 2;
  return 1;
}

export function applyQueueCaption(ticket: ApplyQueueTicket): string {
  return `${applyQueueStage(ticket)} · ${applyQueueStep(ticket)}/4`;
}

export function isApplyQueueWatchStatus(
  status: ThermoCommandStatus,
): boolean {
  return status === "pending" || status === "sent" || status === "applied";
}

export function isApplyQueueInWindow(
  createdAt: string,
  nowMs = Date.now(),
): boolean {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return false;
  const age = nowMs - created;
  return age <= APPLY_QUEUE_WINDOW_MS && age >= -APPLY_QUEUE_START_GRACE_MS;
}

export function applyQueueTargetKey(command: {
  moduleUid: number;
  controllerKey: string;
  channel?: ChannelSlot | null;
}): string {
  return `${command.moduleUid}:${command.controllerKey}:${command.channel ?? "_"}`;
}

export function selectApplyQueueCommands<
  T extends {
    id: string;
    status: ThermoCommandStatus;
    createdAt: string;
    farmKey: FarmKey;
    moduleUid: number;
    controllerKey: string;
    channel?: ChannelSlot | null;
  },
>(
  commands: T[],
  farmKey: FarmKey | null,
  limit = 16,
  nowMs = Date.now(),
): T[] {
  if (!farmKey) return [];
  const farmId = farmKeyId(farmKey);
  const newestFirst = commands
    .filter((command) => farmKeyId(command.farmKey) === farmId)
    .filter((command) => isApplyQueueWatchStatus(command.status))
    .filter((command) => isApplyQueueInWindow(command.createdAt, nowMs))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const seen = new Set<string>();
  const selected: T[] = [];
  for (const command of newestFirst) {
    const target = applyQueueTargetKey(command);
    if (seen.has(target)) continue;
    seen.add(target);
    selected.push(command);
    if (selected.length >= limit) break;
  }
  return selected;
}

export function applyQueueReadingKey(
  readings: Array<{
    key: string;
    farmKey: FarmKey;
    moduleUid: number;
    controllerKey: string;
  }>,
  command: {
    farmKey: FarmKey;
    moduleUid: number;
    controllerKey: string;
  },
): string | null {
  const farmId = farmKeyId(command.farmKey);
  return (
    readings.find(
      (reading) =>
        farmKeyId(reading.farmKey) === farmId &&
        reading.moduleUid === command.moduleUid &&
        reading.controllerKey === command.controllerKey,
    )?.key ?? null
  );
}

/** LIVE 키가 없어도 최근 1시간 목록에 남긴다. */
export function applyQueueRowKey(
  readings: Array<{
    key: string;
    farmKey: FarmKey;
    moduleUid: number;
    controllerKey: string;
  }>,
  command: {
    farmKey: FarmKey;
    moduleUid: number;
    controllerKey: string;
  },
): string {
  return (
    applyQueueReadingKey(readings, command) ??
    `queue:${farmKeyId(command.farmKey)}:${command.moduleUid}:${command.controllerKey}`
  );
}
