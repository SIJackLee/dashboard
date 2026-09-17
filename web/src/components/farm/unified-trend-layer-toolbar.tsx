"use client";

import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Check,
  Droplets,
  Fan,
  Layers,
  Thermometer,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CHANNEL_SLOT_LABELS, type ChannelSlot } from "@/lib/data/iot-channel";
import {
  COMMAND_HOLD_CHANNELS,
  type CommandChannelFlags,
} from "@/lib/farm/command-hold-bands";
import type {
  UnifiedLayerFlags,
  UnifiedLayerId,
} from "@/lib/farm/unified-barn-trend-series";
import { AlarmDomainIcon } from "@/components/settings/alarm-domain-icon";
import { dashboardAffordance, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Tone = "temp" | "hum" | "motor" | "command" | "neutral";

export type LayerGroupId = "temp" | "hum" | "motor";

/** 그룹 토글 사이클: 기본보기(본선+산포) ↔ 끔 */
export type LayerGroupCycleMode = "base" | "off";

export type UnifiedTrendLayerAvailable = Record<UnifiedLayerId, boolean>;

const GROUP_MAIN: Record<LayerGroupId, UnifiedLayerId> = {
  temp: "temp",
  hum: "hum",
  motor: "motors",
};

/** 끌 때 함께 끄는 상세 레이어(범위·추세·채널 등) */
const GROUP_SUBS: Record<LayerGroupId, readonly UnifiedLayerId[]> = {
  temp: ["ema", "dev", "band"],
  hum: ["humEma", "humDev", "humBand"],
  motor: ["motorCh"],
};

/** 기본보기 — 본선 + 산포. 모터는 본선만. 설정 변경은 별도 토글 */
const GROUP_BASE_SUBS: Record<LayerGroupId, readonly UnifiedLayerId[]> = {
  temp: ["band"],
  hum: ["humBand"],
  motor: [],
};

const GROUP_META: Record<
  LayerGroupId,
  {
    tone: Tone;
    Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
    baseLabel: string;
  }
> = {
  temp: { tone: "temp", Icon: Thermometer, baseLabel: "온도" },
  hum: { tone: "hum", Icon: Droplets, baseLabel: "습도" },
  motor: { tone: "motor", Icon: Fan, baseLabel: "모터" },
};

function availableSubs(
  group: LayerGroupId,
  available: UnifiedTrendLayerAvailable,
): UnifiedLayerId[] {
  return GROUP_SUBS[group].filter((id) => available[id]);
}

function availableBaseSubs(
  group: LayerGroupId,
  available: UnifiedTrendLayerAvailable,
): UnifiedLayerId[] {
  return GROUP_BASE_SUBS[group].filter((id) => available[id]);
}

export function detectLayerGroupMode(
  layers: UnifiedLayerFlags,
  available: UnifiedTrendLayerAvailable,
  group: LayerGroupId,
): LayerGroupCycleMode {
  const main = GROUP_MAIN[group];
  const subs = availableSubs(group, available);
  const mainOn = layers[main];
  const anySubOn = subs.some((id) => layers[id]);

  if (!mainOn && !anySubOn) return "off";
  return "base";
}

export function nextLayerGroupMode(
  mode: LayerGroupCycleMode,
): LayerGroupCycleMode {
  return mode === "base" ? "off" : "base";
}

export function applyLayerGroupMode(
  prev: UnifiedLayerFlags,
  group: LayerGroupId,
  mode: LayerGroupCycleMode,
  available: UnifiedTrendLayerAvailable,
): UnifiedLayerFlags {
  const next = { ...prev };
  const main = GROUP_MAIN[group];
  const baseSubs = availableBaseSubs(group, available);

  if (mode === "base") {
    next[main] = true;
    for (const id of GROUP_SUBS[group]) next[id] = false;
    for (const id of baseSubs) next[id] = true;
    return next;
  }

  next[main] = false;
  for (const id of GROUP_SUBS[group]) next[id] = false;
  return next;
}

function modeTooltip(group: LayerGroupId, mode: LayerGroupCycleMode): string {
  const name = GROUP_META[group].baseLabel;
  if (mode === "base") return `${name} 기본보기`;
  return `${name} 그래프 끔`;
}

function nextModeHint(group: LayerGroupId, mode: LayerGroupCycleMode): string {
  return `다음: ${modeTooltip(group, nextLayerGroupMode(mode))}`;
}

function alarmRangeTooltip(kind: "temp" | "hum", on: boolean): string {
  const name = kind === "temp" ? "온도 알람" : "습도 알람";
  return on
    ? `${name} 범위 켜짐 · 다음: 끔`
    : `${name} 범위 꺼짐 · 다음: 켬`;
}

type Props = {
  layers: UnifiedLayerFlags;
  available: UnifiedTrendLayerAvailable;
  onCycleGroup: (group: LayerGroupId) => void;
  className?: string;
  /** @deprecated 헤더 인라인만 사용. hub 무시 */
  placement?: "hub" | "inline";
  /** 오버레이 — 켜진 온도·습도·모터를 한 밴드에 겹침. 플롯 밴드 2개 이상일 때 노출 */
  overlayView?: boolean;
  overlayAvailable?: boolean;
  onToggleOverlay?: () => void;
  /** 온도·습도 알람 범위 띠 (헤더 ON/OFF) */
  tempAlarmOn?: boolean;
  humAlarmOn?: boolean;
  tempAlarmAvailable?: boolean;
  humAlarmAvailable?: boolean;
  onToggleTempAlarm?: () => void;
  onToggleHumAlarm?: () => void;
  /** 위젯 헤더 — 상·좌 여백과 같은 32px 버튼 */
  compact?: boolean;
};

function toneActiveClass(tone: Tone): string {
  switch (tone) {
    case "temp":
      return dashboardUi.chartLayerGroupTemp;
    case "hum":
      return dashboardUi.chartLayerGroupHum;
    case "motor":
      return dashboardUi.chartLayerGroupMotor;
    case "command":
      return dashboardUi.chartLayerGroupCommand;
    default:
      return "border-border bg-muted text-foreground";
  }
}

function iconBtnClass(
  active: boolean,
  muted: boolean,
  tone: Tone,
  compact = false,
) {
  return cn(
    "relative inline-flex shrink-0 items-center justify-center overflow-visible rounded-md border",
    compact ? "size-8" : "size-9 md:size-11",
    motionClass.microInteractive,
    active
      ? toneActiveClass(tone)
      : muted
        ? cn(dashboardAffordance.chipToggleIdle, "text-muted-foreground/80")
        : dashboardUi.chartLayerActionBtnIdle,
  );
}

function IconTipButton({
  label,
  on,
  pressed,
  muted,
  tone = "neutral",
  compact = false,
  onClick,
  children,
  className,
  style,
}: {
  label: string;
  on?: boolean;
  pressed?: boolean;
  muted?: boolean;
  tone?: Tone;
  compact?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const active = Boolean(on ?? pressed);
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        className={cn(
          iconBtnClass(active, Boolean(muted), tone, compact),
          className,
        )}
        style={style}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8} className="z-[80]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function ModeOverlay({ mode }: { mode: LayerGroupCycleMode }) {
  const Icon = mode === "base" ? Check : X;
  return (
    <span
      key={mode}
      className={cn(
        "pointer-events-none absolute -right-0.5 -top-0.5 z-[2] flex size-3.5 items-center justify-center rounded-full border bg-background shadow-sm",
        mode === "off"
          ? "border-muted-foreground/40 text-muted-foreground"
          : "border-current/30 text-current",
        motionClass.farmChartLayerBadgePop,
      )}
      aria-hidden
    >
      <Icon className="size-2.5" strokeWidth={2.5} />
    </span>
  );
}

/**
 * 차트 레이어 툴바 — 온도·습도·모터 가로 버튼 (헤더용).
 * 각 버튼 클릭: 기본보기(본선+산포) ↔ 끔.
 */
export function UnifiedTrendLayerToolbar({
  layers,
  available,
  onCycleGroup,
  className,
  overlayView = false,
  overlayAvailable = false,
  onToggleOverlay,
  tempAlarmOn = true,
  humAlarmOn = true,
  tempAlarmAvailable = false,
  humAlarmAvailable = false,
  onToggleTempAlarm,
  onToggleHumAlarm,
  compact = false,
}: Props) {
  const groups = (
    [
      available.temp ? "temp" : null,
      available.hum ? "hum" : null,
      available.motors ? "motor" : null,
    ] as const
  ).filter((g): g is LayerGroupId => g != null);

  if (groups.length === 0) return null;

  return (
    <TooltipProvider delay={200}>
      <div
        className={cn(
          "inline-flex items-center gap-1 overflow-visible",
          className,
        )}
        data-tour-id="unified-trend-layer-toolbar"
        data-placement="inline"
        role="group"
        aria-label="통합 추이 레이어"
      >
        {groups.map((group) => {
          const meta = GROUP_META[group];
          const Icon = meta.Icon;
          const mode = detectLayerGroupMode(layers, available, group);
          const on = mode !== "off";
          const tip = `${modeTooltip(group, mode)} · ${nextModeHint(group, mode)}`;

          return (
            <div
              key={group}
              className="relative overflow-visible"
            >
              <IconTipButton
                label={tip}
                pressed={on}
                on={on}
                muted={!on}
                tone={meta.tone}
                compact={compact}
                onClick={() => onCycleGroup(group)}
              >
                <Icon
                  className={compact ? "size-4" : "size-4 md:size-5"}
                  aria-hidden
                />
                <ModeOverlay mode={mode} />
              </IconTipButton>
            </div>
          );
        })}
        {overlayAvailable && onToggleOverlay ? (
          <div className="relative overflow-visible">
            <IconTipButton
              label={
                overlayView
                  ? "오버레이 보기 끔 · 온도·습도·모터 분리"
                  : "오버레이 보기 · 온도·습도·모터 겹쳐보기"
              }
              pressed={overlayView}
              on={overlayView}
              muted={!overlayView}
              tone="motor"
              compact={compact}
              onClick={onToggleOverlay}
            >
              <Layers
                className={compact ? "size-4" : "size-4 md:size-5"}
                aria-hidden
              />
            </IconTipButton>
          </div>
        ) : null}
        {(tempAlarmAvailable && onToggleTempAlarm) ||
        (humAlarmAvailable && onToggleHumAlarm) ? (
          <span
            className="mx-0.5 h-5 w-px shrink-0 bg-border"
            aria-hidden
          />
        ) : null}
        {tempAlarmAvailable && onToggleTempAlarm ? (
          <div className="relative overflow-visible">
            <IconTipButton
              label={alarmRangeTooltip("temp", tempAlarmOn)}
              pressed={tempAlarmOn}
              on={tempAlarmOn}
              muted={!tempAlarmOn}
              tone="temp"
              compact={compact}
              onClick={onToggleTempAlarm}
            >
              <AlarmDomainIcon
                domain="temp"
                tone="inherit"
                sizeClass={compact ? "size-3" : "size-3.5 md:size-4"}
              />
              <ModeOverlay mode={tempAlarmOn ? "base" : "off"} />
            </IconTipButton>
          </div>
        ) : null}
        {humAlarmAvailable && onToggleHumAlarm ? (
          <div className="relative overflow-visible">
            <IconTipButton
              label={alarmRangeTooltip("hum", humAlarmOn)}
              pressed={humAlarmOn}
              on={humAlarmOn}
              muted={!humAlarmOn}
              tone="hum"
              compact={compact}
              onClick={onToggleHumAlarm}
            >
              <AlarmDomainIcon
                domain="humidity"
                tone="inherit"
                sizeClass={compact ? "size-3" : "size-3.5 md:size-4"}
              />
              <ModeOverlay mode={humAlarmOn ? "base" : "off"} />
            </IconTipButton>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

/** 명령 이력 채널 A·B·C 켜기/끄기. 명령 토글이 켜진 뒤 그래프 아래에 둔다. */
export function CommandChannelLayerToolbar({
  channels,
  onToggle,
  className,
}: {
  channels: CommandChannelFlags;
  onToggle: (channel: ChannelSlot) => void;
  className?: string;
}) {
  return (
    <TooltipProvider delay={200}>
      <div
        className={cn(
          "inline-flex items-center gap-1 overflow-visible",
          className,
        )}
        data-tour-id="chart-command-channel-toolbar"
        role="group"
        aria-label="명령 이력 채널"
      >
        {COMMAND_HOLD_CHANNELS.map((channel) => {
          const on = channels[channel];
          const label = on
            ? `${CHANNEL_SLOT_LABELS[channel]} 명령 이력 · 다음: 끔`
            : `${CHANNEL_SLOT_LABELS[channel]} 명령 이력 끔 · 다음: 켬`;
          return (
            <div key={channel} className="relative overflow-visible">
              <IconTipButton
                label={label}
                pressed={on}
                on={on}
                muted={!on}
                tone="command"
                onClick={() => onToggle(channel)}
              >
                <span className="text-[0.7rem] font-semibold md:text-sm" aria-hidden>
                  {channel}
                </span>
                <ModeOverlay mode={on ? "base" : "off"} />
              </IconTipButton>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
