import {
  resolveThermoSettings,
  thermoFromDecoded,
  thermoValuesMatch,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { ThermoCommandStatus } from "@/lib/data/commands";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import { normalizeStallTyCode } from "@/lib/data/stall-type";
import {
  applyQueueStage,
  formatApplyQueueTargetLine,
  isApplyQueueWatchStatus,
  type ApplyQueueStage,
} from "@/lib/farm/apply-queue";
import { formatKst } from "@/lib/datetime/kst";
import { formatTempDisplay, formatVentDisplay } from "@/lib/farm/command-confirm";
import type { FarmChartScope } from "@/lib/farm/farm-chart-scope";
import { parseCategoryTimelineMs } from "@/lib/farm/trend-display-buckets";
import type { TrendEventLane, TrendEventMark } from "@/lib/data/trend-chart-types";

/** 위(확인) → 아래(접수). 실측 온도 차트와 겹치지 않는 적중 축. */
export const COMMAND_HIT_STAGES = ["확인", "수신", "전송", "접수"] as const;

export type CommandHitStage = (typeof COMMAND_HIT_STAGES)[number];

export type CommandHitSource = {
  id: string;
  createdAt: string;
  status: ThermoCommandStatus;
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
  stallTyCode: string;
  stallNo: string;
  eqpmnNo: string;
  channel?: ChannelSlot | null;
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
};

type DecodedThermo = {
  setpointTemp?: string | number;
  tempDeviation?: string | number;
  minVentPct?: number;
  maxVentPct?: number;
};

export type CommandHitReading = {
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
  channels?: Array<{
    channel: ChannelSlot;
    thermo?: DecodedThermo | null;
  }>;
  thermo?: DecodedThermo | null;
};

export type CommandHitMark = {
  id: string;
  at: string;
  x: number;
  stage: CommandHitStage;
  target: string;
  setpoint: string;
  deviation: string;
  vent: string;
};

export type CommandHitStats = {
  total: number;
  confirmed: number;
  hitPctLabel: string;
  hiddenCount: number;
};

export type CommandHitResult = {
  marks: CommandHitMark[];
  hiddenCount: number;
};

export type CommandHitAxis = {
  start: string;
  end: string;
};

const MAX_MARKS = 80;
const LIVE_END_MS = 2 * 60 * 60 * 1000;
/** 추이 플롯 하단 명령 행 높이(1×). 차트 탭은 farm-chart-ui 배율을 곱한다. */
export const COMMAND_HIT_LANE_PX = 112;

export function isCommandHitStage(
  stage: ApplyQueueStage,
): stage is CommandHitStage {
  return (
    stage === "확인" ||
    stage === "수신" ||
    stage === "전송" ||
    stage === "접수"
  );
}

/** 통합 추이 카테고리 첫·끝 시각. 파싱 실패 시 fallback(브러시). */
export function commandHitTimeSpan(
  categories: string[],
  fallback?: { fromMs: number; toMs: number } | null,
): { fromMs: number; toMs: number } | null {
  const parsed = parseCategoryTimelineMs(categories);
  if (parsed && parsed.length >= 2) {
    const fromMs = parsed[0]!;
    const toMs = parsed[parsed.length - 1]!;
    if (Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs > fromMs) {
      return { fromMs, toMs };
    }
  }
  const fromMs = fallback?.fromMs;
  const toMs = fallback?.toMs;
  if (
    fromMs != null &&
    toMs != null &&
    Number.isFinite(fromMs) &&
    Number.isFinite(toMs) &&
    toMs > fromMs
  ) {
    return { fromMs, toMs };
  }
  return null;
}

/** 데이터 시각 비율 0–1. 플롯 패딩은 TrendChart `xFor`와 같은 매퍼가 적용. */
export function commandHitX(
  createdAt: string,
  fromMs: number,
  toMs: number,
): number | null {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t) || !(toMs > fromMs)) return null;
  if (t < fromMs || t > toMs) return null;
  return (t - fromMs) / (toMs - fromMs);
}

function stallNosEqual(a: string, b: string): boolean {
  const na = Number.parseInt(a.trim(), 10);
  const nb = Number.parseInt(b.trim(), 10);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb;
  return a.trim() === b.trim();
}

export function commandInChartScope(
  command: CommandHitSource,
  scope: FarmChartScope,
): boolean {
  if (scope.level === "farm") return true;
  if (normalizeStallTyCode(command.stallTyCode) !== normalizeStallTyCode(scope.stallTyCode)) {
    return false;
  }
  if (scope.level === "sp") return true;
  if (!stallNosEqual(command.stallNo, scope.stallNo)) return false;
  if (scope.level === "stall") return true;
  return command.controllerKey === scope.controllerKey;
}

function liveThermoForCommand(
  reading: CommandHitReading,
  channel?: ChannelSlot | null,
) {
  if (reading.channels?.length) {
    if (channel) {
      const slot = reading.channels.find((row) => row.channel === channel);
      return thermoFromDecoded(slot?.thermo ?? null);
    }
    const fromA = thermoFromDecoded(
      reading.channels.find((row) => row.channel === "A")?.thermo ?? null,
    );
    if (fromA) return fromA;
    for (const ch of reading.channels) {
      const parsed = thermoFromDecoded(ch.thermo ?? null);
      if (parsed) return parsed;
    }
  }
  return thermoFromDecoded(reading.thermo ?? null);
}

export function commandLiveConfirmed(
  command: CommandHitSource,
  readings: CommandHitReading[],
  thermoSettings: Record<string, ControllerThermoSettings> = {},
  confirmedIds?: ReadonlySet<string>,
): boolean {
  if (confirmedIds?.has(command.id)) return true;
  if (command.status !== "sent" && command.status !== "applied") return false;
  const farmId = farmKeyId(command.farmKey);
  const reading = readings.find(
    (row) =>
      farmKeyId(row.farmKey) === farmId &&
      row.moduleUid === command.moduleUid &&
      row.controllerKey === command.controllerKey,
  );
  if (!reading) return false;
  const live = liveThermoForCommand(reading, command.channel);
  if (live && thermoValuesMatch(live, command)) return true;
  const fromMap = resolveThermoSettings(
    thermoSettings,
    command.farmKey,
    command.moduleUid,
    command.controllerKey,
    command.channel ?? undefined,
  );
  return Boolean(
    fromMap?.source === "live" && thermoValuesMatch(fromMap, command),
  );
}

export function commandHitStats(
  marks: CommandHitMark[],
  hiddenCount = 0,
): CommandHitStats {
  const confirmed = marks.filter((mark) => mark.stage === "확인").length;
  const total = marks.length;
  return {
    total,
    confirmed,
    hiddenCount,
    hitPctLabel:
      total === 0 ? "—" : `${Math.round((confirmed / total) * 100)}%`,
  };
}

export function commandHitStatsLine(
  windowLabel: string,
  stats: CommandHitStats,
): string {
  const count =
    stats.hiddenCount > 0
      ? `최근 ${stats.total}건`
      : `${stats.total}건`;
  return `${windowLabel} · ${count} · 확인 ${stats.confirmed} · 적중 ${stats.hitPctLabel}`;
}

export function commandHitAxis(fromMs: number, toMs: number, nowMs: number): CommandHitAxis {
  return {
    start: formatKst(new Date(fromMs).toISOString(), "short"),
    end:
      Math.abs(toMs - nowMs) <= LIVE_END_MS
        ? "지금"
        : formatKst(new Date(toMs).toISOString(), "short"),
  };
}

export function commandHitNeighborId(
  marks: Array<{ id: string; at: string }>,
  selectedId: string | null,
  delta: number,
): string | null {
  if (marks.length === 0) return null;
  const ordered = [...marks].sort((a, b) => (a.at < b.at ? -1 : 1));
  if (delta === 0) return selectedId ?? ordered[ordered.length - 1]!.id;
  if (!Number.isFinite(delta)) {
    return delta > 0
      ? ordered[ordered.length - 1]!.id
      : ordered[0]!.id;
  }
  const index = ordered.findIndex((mark) => mark.id === selectedId);
  const from =
    index < 0 ? (delta > 0 ? -1 : ordered.length) : index;
  const next = Math.min(ordered.length - 1, Math.max(0, from + delta));
  return ordered[next]!.id;
}

function commandHitPayload(command: CommandHitSource): Pick<
  CommandHitMark,
  "setpoint" | "deviation" | "vent" | "target"
> {
  return {
    target: formatApplyQueueTargetLine({
      stallTyCode: command.stallTyCode,
      stallNo: command.stallNo,
      eqpmnNo: command.eqpmnNo,
      channel: command.channel,
    }),
    setpoint: formatTempDisplay(command.setpointTemp),
    deviation: `±${formatTempDisplay(command.tempDeviation)}`,
    vent: `${formatVentDisplay(command.minVentPct).replace("%", "")}–${formatVentDisplay(command.maxVentPct)}`,
  };
}

export function selectCommandHitResult(opts: {
  commands: CommandHitSource[];
  farmKey: FarmKey | null;
  scope: FarmChartScope;
  fromMs: number;
  toMs: number;
  readings?: CommandHitReading[];
  thermoSettings?: Record<string, ControllerThermoSettings>;
  confirmedIds?: ReadonlySet<string>;
  limit?: number;
}): CommandHitResult {
  const farmKey = opts.farmKey;
  if (!farmKey) return { marks: [], hiddenCount: 0 };
  const farmId = farmKeyId(farmKey);
  const readings = opts.readings ?? [];
  const thermoSettings = opts.thermoSettings ?? {};
  const limit = opts.limit ?? MAX_MARKS;

  const eligible = opts.commands
    .filter((command) => farmKeyId(command.farmKey) === farmId)
    .filter((command) => isApplyQueueWatchStatus(command.status))
    .filter((command) => commandInChartScope(command, opts.scope))
    .map((command) => {
      const x = commandHitX(command.createdAt, opts.fromMs, opts.toMs);
      if (x == null) return null;
      const liveConfirmed = commandLiveConfirmed(
        command,
        readings,
        thermoSettings,
        opts.confirmedIds,
      );
      const stage = applyQueueStage({
        status: command.status,
        liveConfirmed,
      });
      if (!isCommandHitStage(stage)) return null;
      return {
        id: command.id,
        at: command.createdAt,
        x,
        stage,
        ...commandHitPayload(command),
      } satisfies CommandHitMark;
    })
    .filter((mark): mark is CommandHitMark => mark != null)
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  const trimmed = eligible.slice(0, limit).sort((a, b) => (a.at < b.at ? -1 : 1));
  return {
    marks: trimmed,
    hiddenCount: Math.max(0, eligible.length - trimmed.length),
  };
}

export function selectCommandHitMarks(
  opts: Parameters<typeof selectCommandHitResult>[0],
): CommandHitMark[] {
  return selectCommandHitResult(opts).marks;
}

function commandHitInfoStrength(
  stage: CommandHitStage,
): 1 | 2 | 3 | undefined {
  if (stage === "확인") return undefined;
  if (stage === "수신") return 3;
  if (stage === "전송") return 2;
  return 1;
}

export function commandHitToEventMark(mark: CommandHitMark): TrendEventMark {
  const row = Math.max(0, COMMAND_HIT_STAGES.indexOf(mark.stage));
  return {
    id: mark.id,
    atMs: Date.parse(mark.at),
    row,
    tone: mark.stage === "확인" ? "ok" : "info",
    infoStrength: commandHitInfoStrength(mark.stage),
    ariaLabel: `${formatKst(mark.at, "short")} ${mark.stage} ${mark.setpoint}`,
    card: {
      badge: "명령",
      time: formatKst(mark.at, "short"),
      hero: mark.setpoint,
      heroTone: mark.stage === "확인" ? "ok" : undefined,
      rows: [
        { label: "단계", value: mark.stage },
        { label: "편차", value: mark.deviation },
        { label: "환기", value: mark.vent },
      ],
      footnote: mark.target,
    },
  };
}

export function commandHitEventLane(opts: {
  marks: CommandHitMark[];
  hiddenCount?: number;
  windowLabel: string;
}): TrendEventLane {
  const stats = commandHitStats(opts.marks, opts.hiddenCount ?? 0);
  return {
    label: "명령",
    rowLabels: [...COMMAND_HIT_STAGES],
    statsLine: commandHitStatsLine(opts.windowLabel, stats),
    emptyLabel: "이 구간에 명령이 없습니다.",
    marks: opts.marks.map(commandHitToEventMark),
  };
}
