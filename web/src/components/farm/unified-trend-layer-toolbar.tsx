"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  Activity,
  AreaChart,
  ArrowUpDown,
  CheckCheck,
  ChevronDown,
  Droplets,
  Fan,
  Layers2,
  LineChart,
  Thermometer,
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

type LayerChip = {
  id: UnifiedLayerId;
  label: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

type Tone = "root" | "temp" | "hum" | "motor" | "neutral";

const TEMP_SUB_CHIPS: LayerChip[] = [
  { id: "ema", label: "EMA", Icon: Activity },
  { id: "dev", label: "편차", Icon: ArrowUpDown },
  { id: "band", label: "산포", Icon: AreaChart },
];

const HUM_SUB_CHIPS: LayerChip[] = [
  { id: "humEma", label: "EMA", Icon: Activity },
  { id: "humDev", label: "편차", Icon: ArrowUpDown },
  { id: "humBand", label: "산포", Icon: AreaChart },
];

const MOTOR_SUB_CHIPS: LayerChip[] = [
  { id: "motorCh", label: "채널 A/B/C", Icon: Layers2 },
];

export type UnifiedTrendLayerAvailable = Record<UnifiedLayerId, boolean>;

type Props = {
  layers: UnifiedLayerFlags;
  available: UnifiedTrendLayerAvailable;
  tempMenuOpen: boolean;
  humMenuOpen: boolean;
  motorMenuOpen: boolean;
  onTempMenuOpenChange: (open: boolean) => void;
  onHumMenuOpenChange: (open: boolean) => void;
  onMotorMenuOpenChange: (open: boolean) => void;
  onToggleLayer: (id: UnifiedLayerId) => void;
  onEnableGroupAll: (group: "temp" | "hum" | "motor") => void;
  className?: string;
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

function badgeToneClass(tone: Tone): string {
  switch (tone) {
    case "temp":
      return dashboardUi.chartLayerBadgeTemp;
    case "hum":
      return dashboardUi.chartLayerBadgeHum;
    case "motor":
      return dashboardUi.chartLayerBadgeMotor;
    default:
      return dashboardUi.chartLayerBadge;
  }
}

/** 헤더 도구 버튼(size-9 / md:size-11) + 고유색 border 패턴 */
function iconBtnClass(active: boolean, muted: boolean, tone: Tone) {
  return cn(
    "relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg border md:size-11",
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

function LayerCountBadge({
  count,
  tone = "root",
}: {
  count: number;
  tone?: Tone;
}) {
  if (count <= 0) return null;
  return (
    <span
      key={count}
      className={cn(
        "absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full",
        "text-[8px] font-semibold md:size-4 md:text-[9px]",
        badgeToneClass(tone),
        motionClass.farmChartLayerBadgePop,
      )}
    >
      {count}
    </span>
  );
}

function LayerFlyout({
  id,
  open,
  items,
  side,
  tone,
}: {
  id: string;
  open: boolean;
  items: ReactNode[];
  /** bottom=아래로, left=오른쪽→왼쪽 */
  side: "bottom" | "left";
  tone: Tone;
}) {
  const { mounted, phase } = useOpenPresence(open, motionDuration.exit + 80);
  const nodes = useMemo(
    () => items.filter((n) => n != null),
    [items],
  );

  if (!mounted) return null;

  const enter =
    side === "left"
      ? motionClass.farmChartLayerFlyoutRtlEnter
      : motionClass.farmChartLayerFlyoutEnter;
  const exit =
    side === "left"
      ? motionClass.farmChartLayerFlyoutRtlExit
      : motionClass.farmChartLayerFlyoutExit;
  const itemEnter =
    side === "left"
      ? motionClass.farmChartLayerFlyoutRtlItemEnter
      : motionClass.farmChartLayerFlyoutItemEnter;
  const itemExit =
    side === "left"
      ? motionClass.farmChartLayerFlyoutRtlItemExit
      : motionClass.farmChartLayerFlyoutItemExit;

  return (
    <div
      id={id}
      role="group"
      className={cn(
        "absolute z-[70] flex gap-0.5 rounded-xl border bg-popover/95 p-1.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm",
        side === "bottom"
          ? "right-0 top-[calc(100%+8px)] flex-col"
          : "right-[calc(100%+8px)] top-0 flex-row-reverse items-center",
        tone === "temp" && "border-rose-300/50 dark:border-rose-900/40",
        tone === "hum" && "border-sky-300/50 dark:border-sky-900/40",
        tone === "motor" && "border-amber-300/50 dark:border-amber-900/40",
        tone === "root" && "border-sky-300/50 dark:border-sky-900/40",
        phase === "enter" ? enter : exit,
      )}
      aria-hidden={phase === "exit"}
      data-farm-layer-flyout=""
      data-side={side}
      data-phase={phase}
    >
      {nodes.map((node, i) => (
        <div
          key={i}
          className={phase === "enter" ? itemEnter : itemExit}
          style={
            {
              ["--farm-layer-flyout-i" as string]: String(i),
              ["--farm-layer-flyout-n" as string]: String(nodes.length),
            } as CSSProperties
          }
        >
          {node}
        </div>
      ))}
    </div>
  );
}

/**
 * 차트 레이어 툴바 — ScopeBar 우측.
 * 루트(차트 아이콘) → 아래 온도/습도/팬 → 왼쪽 하위 레이어.
 */
export function UnifiedTrendLayerToolbar({
  layers,
  available,
  tempMenuOpen,
  humMenuOpen,
  motorMenuOpen,
  onTempMenuOpenChange,
  onHumMenuOpenChange,
  onMotorMenuOpenChange,
  onToggleLayer,
  onEnableGroupAll,
  className,
}: Props) {
  const [rootOpen, setRootOpen] = useState(false);

  const tempCount = TEMP_SUB_CHIPS.filter(
    (c) => available[c.id] && layers[c.id],
  ).length;
  const humCount = HUM_SUB_CHIPS.filter(
    (c) => available[c.id] && layers[c.id],
  ).length;
  const motorCount = MOTOR_SUB_CHIPS.filter(
    (c) => available[c.id] && layers[c.id],
  ).length;
  const totalActive =
    (available.temp && layers.temp ? 1 + tempCount : 0) +
    (available.hum && layers.hum ? 1 + humCount : 0) +
    (available.motors && layers.motors ? 1 + motorCount : 0);

  const closeGroups = () => {
    onTempMenuOpenChange(false);
    onHumMenuOpenChange(false);
    onMotorMenuOpenChange(false);
  };

  useEffect(() => {
    if (rootOpen) return;
    closeGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 루트 닫힐 때만 그룹 정리
  }, [rootOpen]);

  const renderSub = (chip: LayerChip, tone: Tone) => {
    if (!available[chip.id]) return null;
    const on = layers[chip.id];
    const Icon = chip.Icon;
    return (
      <IconTipButton
        key={chip.id}
        label={chip.label}
        pressed={on}
        on={on}
        tone={tone}
        onClick={() => onToggleLayer(chip.id)}
      >
        <Icon className="size-4 md:size-5" aria-hidden />
      </IconTipButton>
    );
  };

  const groupOrder = (
    [
      available.temp ? "temp" : null,
      available.hum ? "hum" : null,
      available.motors ? "motors" : null,
    ] as const
  ).filter((g): g is "temp" | "hum" | "motors" => g != null);

  const iconI = (group: "temp" | "hum" | "motors"): CSSProperties => ({
    ["--farm-layer-icon-i" as string]: String(groupOrder.indexOf(group)),
    ["--farm-layer-icon-n" as string]: String(Math.max(1, groupOrder.length)),
  });

  const { mounted: rootMounted, phase: rootPhase } = useOpenPresence(
    rootOpen,
    motionDuration.exit + 100,
  );

  const rootAccent = rootOpen || totalActive > 0;

  return (
    <TooltipProvider delay={200}>
      <div
        className={cn("relative inline-flex items-center", className)}
        data-tour-id="unified-trend-layer-toolbar"
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
          <LayerCountBadge count={totalActive} tone="root" />
          <ChevronDown
            className={cn(
              "pointer-events-none absolute bottom-0.5 size-2.5 opacity-50 transition-transform duration-[var(--motion-duration-fast)]",
              rootOpen && "rotate-180",
            )}
            aria-hidden
          />
        </IconTipButton>

        {rootMounted ? (
          <div
            id="unified-layer-groups"
            role="group"
            aria-label="레이어 그룹"
            data-farm-layer-column=""
            data-phase={rootPhase}
            className={cn(
              "absolute right-0 top-[calc(100%+8px)] z-[70] flex flex-col gap-1 rounded-xl border border-sky-300/50 bg-popover/95 p-1.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm dark:border-sky-900/40",
              rootPhase === "enter"
                ? motionClass.farmChartLayerColumnEnter
                : motionClass.farmChartLayerColumnExit,
            )}
            aria-hidden={rootPhase === "exit"}
            style={
              {
                ["--farm-layer-icon-n" as string]: String(
                  Math.max(1, groupOrder.length),
                ),
              } as CSSProperties
            }
          >
            {available.temp ? (
              <div
                className={cn(
                  "relative",
                  rootPhase === "enter"
                    ? motionClass.farmChartLayerIconEnter
                    : motionClass.farmChartLayerIconExit,
                )}
                style={iconI("temp")}
              >
                <IconTipButton
                  label={`온도${layers.temp ? "" : " (숨김)"}`}
                  on={layers.temp || tempMenuOpen}
                  muted={!layers.temp && !tempMenuOpen}
                  expanded={tempMenuOpen}
                  controls="unified-temp-sublayers"
                  tone="temp"
                  onClick={() => {
                    const next = !tempMenuOpen;
                    onTempMenuOpenChange(next);
                    if (next) {
                      onHumMenuOpenChange(false);
                      onMotorMenuOpenChange(false);
                    }
                  }}
                >
                  <Thermometer className="size-4 md:size-5" aria-hidden />
                  {layers.temp ? (
                    <LayerCountBadge count={tempCount} tone="temp" />
                  ) : null}
                </IconTipButton>
                <LayerFlyout
                  id="unified-temp-sublayers"
                  open={tempMenuOpen}
                  side="left"
                  tone="temp"
                  items={[
                    <IconTipButton
                      key="temp-main"
                      label={
                        layers.temp ? "온도 그래프 끄기" : "온도 그래프 켜기"
                      }
                      pressed={layers.temp}
                      on={layers.temp}
                      tone="temp"
                      onClick={() => onToggleLayer("temp")}
                    >
                      <Thermometer className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>,
                    <IconTipButton
                      key="temp-all"
                      label="온도 전체 적용"
                      on={
                        layers.temp &&
                        TEMP_SUB_CHIPS.every(
                          (c) => !available[c.id] || layers[c.id],
                        )
                      }
                      tone="temp"
                      onClick={() => onEnableGroupAll("temp")}
                    >
                      <CheckCheck className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>,
                    ...TEMP_SUB_CHIPS.map((c) => renderSub(c, "temp")),
                  ]}
                />
              </div>
            ) : null}

            {available.hum ? (
              <div
                className={cn(
                  "relative",
                  rootPhase === "enter"
                    ? motionClass.farmChartLayerIconEnter
                    : motionClass.farmChartLayerIconExit,
                )}
                style={iconI("hum")}
              >
                <IconTipButton
                  label={`습도${layers.hum ? "" : " (숨김)"}`}
                  on={layers.hum || humMenuOpen}
                  muted={!layers.hum && !humMenuOpen}
                  expanded={humMenuOpen}
                  controls="unified-hum-sublayers"
                  tone="hum"
                  onClick={() => {
                    const next = !humMenuOpen;
                    onHumMenuOpenChange(next);
                    if (next) {
                      onTempMenuOpenChange(false);
                      onMotorMenuOpenChange(false);
                    }
                  }}
                >
                  <Droplets className="size-4 md:size-5" aria-hidden />
                  {layers.hum ? (
                    <LayerCountBadge count={humCount} tone="hum" />
                  ) : null}
                </IconTipButton>
                <LayerFlyout
                  id="unified-hum-sublayers"
                  open={humMenuOpen}
                  side="left"
                  tone="hum"
                  items={[
                    <IconTipButton
                      key="hum-main"
                      label={
                        layers.hum ? "습도 그래프 끄기" : "습도 그래프 켜기"
                      }
                      pressed={layers.hum}
                      on={layers.hum}
                      tone="hum"
                      onClick={() => onToggleLayer("hum")}
                    >
                      <Droplets className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>,
                    <IconTipButton
                      key="hum-all"
                      label="습도 전체 적용"
                      on={
                        layers.hum &&
                        HUM_SUB_CHIPS.every(
                          (c) => !available[c.id] || layers[c.id],
                        )
                      }
                      tone="hum"
                      onClick={() => onEnableGroupAll("hum")}
                    >
                      <CheckCheck className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>,
                    ...HUM_SUB_CHIPS.map((c) => renderSub(c, "hum")),
                  ]}
                />
              </div>
            ) : null}

            {available.motors ? (
              <div
                className={cn(
                  "relative",
                  rootPhase === "enter"
                    ? motionClass.farmChartLayerIconEnter
                    : motionClass.farmChartLayerIconExit,
                )}
                style={iconI("motors")}
              >
                <IconTipButton
                  label={`모터${layers.motors ? "" : " (숨김)"}`}
                  on={layers.motors || motorMenuOpen}
                  muted={!layers.motors && !motorMenuOpen}
                  expanded={motorMenuOpen}
                  controls="unified-motor-sublayers"
                  tone="motor"
                  onClick={() => {
                    const next = !motorMenuOpen;
                    onMotorMenuOpenChange(next);
                    if (next) {
                      onTempMenuOpenChange(false);
                      onHumMenuOpenChange(false);
                    }
                  }}
                >
                  <Fan className="size-4 md:size-5" aria-hidden />
                  {layers.motors ? (
                    <LayerCountBadge count={motorCount} tone="motor" />
                  ) : null}
                </IconTipButton>
                <LayerFlyout
                  id="unified-motor-sublayers"
                  open={motorMenuOpen}
                  side="left"
                  tone="motor"
                  items={[
                    <IconTipButton
                      key="motor-main"
                      label={
                        layers.motors
                          ? "모터 그래프 끄기"
                          : "모터 그래프 켜기"
                      }
                      pressed={layers.motors}
                      on={layers.motors}
                      tone="motor"
                      onClick={() => onToggleLayer("motors")}
                    >
                      <Fan className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>,
                    <IconTipButton
                      key="motor-all"
                      label="모터 전체 적용"
                      on={
                        layers.motors &&
                        MOTOR_SUB_CHIPS.every(
                          (c) => !available[c.id] || layers[c.id],
                        )
                      }
                      tone="motor"
                      onClick={() => onEnableGroupAll("motor")}
                    >
                      <CheckCheck className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>,
                    ...MOTOR_SUB_CHIPS.map((c) => renderSub(c, "motor")),
                  ]}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
