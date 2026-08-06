"use client";

import {
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Check,
  CheckCheck,
  Droplets,
  Fan,
  Thermometer,
  X,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  UnifiedLayerFlags,
  UnifiedLayerId,
} from "@/lib/farm/unified-barn-trend-series";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Tone = "temp" | "hum" | "motor" | "neutral";

export type LayerGroupId = "temp" | "hum" | "motor";

/** 그룹 토글 사이클: 본선만 → 전체 → 끔 → 본선만 */
export type LayerGroupCycleMode = "all" | "base" | "off";

export type UnifiedTrendLayerAvailable = Record<UnifiedLayerId, boolean>;

const GROUP_MAIN: Record<LayerGroupId, UnifiedLayerId> = {
  temp: "temp",
  hum: "hum",
  motor: "motors",
};

const GROUP_SUBS: Record<LayerGroupId, readonly UnifiedLayerId[]> = {
  /* 전체 = 본선 + 분포 + 범위 + 추세 */
  temp: ["ema", "dev", "band"],
  hum: ["humEma", "humDev", "humBand"],
  motor: ["motorCh"],
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

export function detectLayerGroupMode(
  layers: UnifiedLayerFlags,
  available: UnifiedTrendLayerAvailable,
  group: LayerGroupId,
): LayerGroupCycleMode {
  const main = GROUP_MAIN[group];
  const subs = availableSubs(group, available);
  const mainOn = layers[main];
  const onSubs = subs.filter((id) => layers[id]);
  const allSubsOn = subs.length === 0 || onSubs.length === subs.length;
  const noSubsOn = onSubs.length === 0;

  if (!mainOn && noSubsOn) return "off";
  if (mainOn && allSubsOn) return "all";
  if (mainOn && noSubsOn) return "base";
  /* 본선+일부 상세 → 끔으로 정리 유도(다음 클릭에서 전체로) */
  if (mainOn) return "off";
  return "off";
}

export function nextLayerGroupMode(
  mode: LayerGroupCycleMode,
): LayerGroupCycleMode {
  if (mode === "base") return "all";
  if (mode === "all") return "off";
  return "base";
}

export function applyLayerGroupMode(
  prev: UnifiedLayerFlags,
  group: LayerGroupId,
  mode: LayerGroupCycleMode,
  available: UnifiedTrendLayerAvailable,
): UnifiedLayerFlags {
  const next = { ...prev };
  const main = GROUP_MAIN[group];
  const subs = availableSubs(group, available);

  if (mode === "all") {
    next[main] = true;
    for (const id of subs) next[id] = true;
    return next;
  }
  if (mode === "base") {
    next[main] = true;
    for (const id of GROUP_SUBS[group]) next[id] = false;
    return next;
  }
  // off — 그룹 그래프 해제
  next[main] = false;
  for (const id of GROUP_SUBS[group]) next[id] = false;
  return next;
}

function modeTooltip(group: LayerGroupId, mode: LayerGroupCycleMode): string {
  const name = GROUP_META[group].baseLabel;
  if (mode === "all") return `${name} 전체 적용`;
  if (mode === "base") return `${name}만`;
  return `${name} 그래프 끔`;
}

function nextModeHint(group: LayerGroupId, mode: LayerGroupCycleMode): string {
  return `다음: ${modeTooltip(group, nextLayerGroupMode(mode))}`;
}

type Props = {
  layers: UnifiedLayerFlags;
  available: UnifiedTrendLayerAvailable;
  onCycleGroup: (group: LayerGroupId) => void;
  className?: string;
  /** @deprecated 헤더 인라인만 사용. hub 무시 */
  placement?: "hub" | "inline";
};

function toneActiveClass(tone: Tone): string {
  switch (tone) {
    case "temp":
      return dashboardUi.chartLayerGroupTemp;
    case "hum":
      return dashboardUi.chartLayerGroupHum;
    case "motor":
      return dashboardUi.chartLayerGroupMotor;
    default:
      return "border-border bg-muted text-foreground";
  }
}

function iconBtnClass(active: boolean, muted: boolean, tone: Tone) {
  return cn(
    "relative inline-flex size-9 shrink-0 items-center justify-center overflow-visible rounded-md border md:size-11",
    motionClass.microInteractive,
    active
      ? toneActiveClass(tone)
      : muted
        ? "border-transparent text-muted-foreground/45 hover:border-border/60 hover:text-muted-foreground"
        : dashboardUi.chartLayerActionBtnIdle,
  );
}

function IconTipButton({
  label,
  on,
  pressed,
  muted,
  tone = "neutral",
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
        className={cn(iconBtnClass(active, Boolean(muted), tone), className)}
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
  const Icon =
    mode === "all" ? CheckCheck : mode === "base" ? Check : X;
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
 * 차트 레이어 툴바 — 온도·습도·모터 가로 3버튼 (헤더용).
 * 각 버튼 클릭: 본선만 → 전체 → 끔 → 본선만.
 */
export function UnifiedTrendLayerToolbar({
  layers,
  available,
  onCycleGroup,
  className,
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
            <div key={group} className="relative overflow-visible">
              <IconTipButton
                label={tip}
                pressed={on}
                on={on}
                muted={!on}
                tone={meta.tone}
                onClick={() => onCycleGroup(group)}
              >
                <Icon className="size-4 md:size-5" aria-hidden />
                <ModeOverlay mode={mode} />
              </IconTipButton>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
