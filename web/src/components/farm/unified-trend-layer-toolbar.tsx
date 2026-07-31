"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Check,
  CheckCheck,
  ChevronDown,
  Droplets,
  Fan,
  LineChart,
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
import { motionDuration } from "@/lib/ui/motion-tokens";
import { useOpenPresence } from "@/lib/ui/use-clip-presence";
import { cn } from "@/lib/utils";

type Tone = "root" | "temp" | "hum" | "motor" | "neutral";

export type LayerGroupId = "temp" | "hum" | "motor";

/** 그룹 토글 사이클: 전체 → 본선만 → 끔 → 전체 */
export type LayerGroupCycleMode = "all" | "base" | "off";

export type UnifiedTrendLayerAvailable = Record<UnifiedLayerId, boolean>;

const GROUP_MAIN: Record<LayerGroupId, UnifiedLayerId> = {
  temp: "temp",
  hum: "hum",
  motor: "motors",
};

const GROUP_SUBS: Record<LayerGroupId, readonly UnifiedLayerId[]> = {
  /* 전체 = 본선 + 편차 + 산포 + EMA5 */
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
  if (mode === "all") return "base";
  if (mode === "base") return "off";
  return "all";
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
  // off — 그룹 그래프 전부
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
  /** hub FAB portal · inline 차트 헤더 */
  placement?: "hub" | "inline";
};

function toneActiveClass(tone: Tone): string {
  switch (tone) {
    case "root":
      return dashboardUi.chartLayerActionBtn;
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
    "relative inline-flex size-9 shrink-0 items-center justify-center overflow-visible rounded-lg border md:size-11",
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
  expanded,
  controls,
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
  expanded?: boolean;
  controls?: string;
  muted?: boolean;
  tone?: Tone;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const active = Boolean(on ?? pressed ?? expanded);
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={onClick}
        className={cn(iconBtnClass(active, Boolean(muted), tone), className)}
        style={style}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={10} className="z-[80]">
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
        "pointer-events-none absolute -right-0.5 -top-0.5 z-[2] flex size-4 items-center justify-center rounded-full border bg-background shadow-sm",
        mode === "off"
          ? "border-muted-foreground/40 text-muted-foreground"
          : "border-current/30 text-current",
        motionClass.farmChartLayerBadgePop,
      )}
      aria-hidden
    >
      <Icon className="size-2.5 md:size-3" strokeWidth={2.5} />
    </span>
  );
}

/**
 * 차트 레이어 툴바 — 온도·습도·모터 대표 3버튼.
 * 각 버튼 클릭: 전체적용 → 본선만 → 끔 → 전체적용.
 * 오버레이: 중첩체크 / 체크 / 엑스
 */
export function UnifiedTrendLayerToolbar({
  layers,
  available,
  onCycleGroup,
  className,
  placement = "inline",
}: Props) {
  const [rootOpen, setRootOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [flyUp, setFlyUp] = useState(placement === "hub");

  useLayoutEffect(() => {
    if (placement !== "hub") {
      setFlyUp(false);
      return;
    }
    const panel = rootRef.current?.closest("[data-hub-layers-flyout]");
    const side = panel?.getAttribute("data-hub-layers-flyout");
    setFlyUp(side !== "down");
  }, [placement, rootOpen]);

  const groups = (
    [
      available.temp ? "temp" : null,
      available.hum ? "hum" : null,
      available.motors ? "motor" : null,
    ] as const
  ).filter((g): g is LayerGroupId => g != null);

  const totalActive = groups.reduce((n, g) => {
    const main = GROUP_MAIN[g];
    const subs = availableSubs(g, available);
    return (
      n +
      (layers[main] ? 1 : 0) +
      subs.filter((id) => layers[id]).length
    );
  }, 0);

  const { mounted: rootMounted, phase: rootPhase } = useOpenPresence(
    rootOpen,
    motionDuration.exit + 100,
  );

  const rootAccent = rootOpen || totalActive > 0;

  return (
    <TooltipProvider delay={200}>
      <div
        ref={rootRef}
        className={cn(
          "relative inline-flex size-9 items-center justify-center overflow-visible md:size-11",
          className,
        )}
        data-tour-id="unified-trend-layer-toolbar"
        data-placement={placement}
        aria-label="통합 추이 레이어"
      >
        <IconTipButton
          label="차트 레이어"
          on={rootAccent}
          expanded={rootOpen}
          controls="unified-layer-groups"
          tone="root"
          onClick={() => setRootOpen((v) => !v)}
        >
          <LineChart className="size-4 md:size-5" aria-hidden />
          {totalActive > 0 ? (
            <span
              className={cn(
                dashboardUi.topHeaderCountBadge,
                dashboardUi.chartLayerBadge,
                "pointer-events-none z-[2]",
                motionClass.farmChartLayerBadgePop,
              )}
            >
              {totalActive > 99 ? "99+" : totalActive}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "pointer-events-none absolute bottom-0.5 size-2.5 opacity-50 transition-transform duration-[var(--motion-duration-fast)]",
              flyUp
                ? rootOpen
                  ? "rotate-0"
                  : "rotate-180"
                : rootOpen && "rotate-180",
            )}
            aria-hidden
          />
        </IconTipButton>

        {rootMounted ? (
          <div
            id="unified-layer-groups"
            role="group"
            aria-label="레이어"
            data-farm-layer-column=""
            data-phase={rootPhase}
            className={cn(
              "absolute z-[90] flex flex-col gap-1.5 overflow-visible",
              placement === "hub"
                ? cn(
                    "left-1/2 -translate-x-1/2 items-center",
                    flyUp
                      ? "bottom-[calc(100%+12px)]"
                      : "top-[calc(100%+12px)]",
                  )
                : cn(
                    "right-0 items-end p-1",
                    flyUp
                      ? "bottom-[calc(100%+8px)]"
                      : "top-[calc(100%+8px)]",
                    "max-md:rounded-xl max-md:border max-md:bg-popover max-md:p-2 max-md:shadow-md max-md:ring-1 max-md:ring-foreground/10",
                  ),
              rootPhase === "enter"
                ? motionClass.farmChartLayerColumnEnter
                : motionClass.farmChartLayerColumnExit,
            )}
            aria-hidden={rootPhase === "exit"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={
              {
                ["--farm-layer-icon-n" as string]: String(
                  Math.max(1, groups.length),
                ),
              } as CSSProperties
            }
          >
            {groups.map((group, staggerIndex) => {
              const meta = GROUP_META[group];
              const Icon = meta.Icon;
              const mode = detectLayerGroupMode(layers, available, group);
              const on = mode !== "off";
              const tip = `${modeTooltip(group, mode)} · ${nextModeHint(group, mode)}`;

              return (
                <div
                  key={group}
                  className={cn(
                    rootPhase === "enter"
                      ? motionClass.farmChartLayerIconEnter
                      : motionClass.farmChartLayerIconExit,
                    "relative overflow-visible",
                  )}
                  style={
                    {
                      ["--farm-layer-icon-i" as string]: String(staggerIndex),
                    } as CSSProperties
                  }
                >
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
        ) : null}
      </div>
    </TooltipProvider>
  );
}
