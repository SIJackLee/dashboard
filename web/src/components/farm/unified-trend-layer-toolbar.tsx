"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
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
  onToggleLayer: (id: UnifiedLayerId) => void;
  onEnableGroupAll: (group: "temp" | "hum" | "motor") => void;
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
        dashboardUi.topHeaderCountBadge,
        badgeToneClass(tone),
        "pointer-events-none z-[2]",
        motionClass.farmChartLayerBadgePop,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** 그룹 한 줄 — 우측 정렬, 메인→전체→하위가 왼쪽으로 */
function LayerIconRow({
  id,
  label,
  staggerIndex,
  phase,
  items,
}: {
  id: string;
  label: string;
  staggerIndex: number;
  phase: "enter" | "exit";
  items: ReactNode[];
}) {
  const nodes = useMemo(() => items.filter((n) => n != null), [items]);
  const itemEnter = motionClass.farmChartLayerFlyoutRtlItemEnter;
  const itemExit = motionClass.farmChartLayerFlyoutRtlItemExit;

  return (
    <div
      id={id}
      role="group"
      aria-label={label}
      className={cn(
        "flex flex-row-reverse items-center gap-1 overflow-visible p-0.5",
        phase === "enter"
          ? motionClass.farmChartLayerIconEnter
          : motionClass.farmChartLayerIconExit,
      )}
      style={
        {
          ["--farm-layer-icon-i" as string]: String(staggerIndex),
          ["--farm-layer-group-i" as string]: String(staggerIndex),
        } as CSSProperties
      }
      data-farm-layer-row=""
    >
      {nodes.map((node, i) => (
        <div
          key={i}
          className={cn(
            phase === "enter" ? itemEnter : itemExit,
            "relative overflow-visible",
          )}
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
 * 차트 레이어 툴바 — TopBar(헤더 도구 왼쪽).
 * 루트(차트 아이콘) → 아래 온도/습도/모터 아이콘 행(우측 정렬).
 * 모바일: 헤더 도구와 같이 카드로 감싸 펼침.
 */
export function UnifiedTrendLayerToolbar({
  layers,
  available,
  onToggleLayer,
  onEnableGroupAll,
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
          <LayerCountBadge count={totalActive} tone="root" />
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
                    "left-1/2 -translate-x-1/2 items-center rounded-2xl border border-border/80 bg-popover p-2 shadow-md ring-1 ring-foreground/10",
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
                  Math.max(1, groupOrder.length),
                ),
              } as CSSProperties
            }
          >
            {available.temp ? (
              <LayerIconRow
                id="unified-temp-sublayers"
                label="온도 레이어"
                staggerIndex={groupOrder.indexOf("temp")}
                phase={rootPhase}
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
                    {layers.temp ? (
                      <LayerCountBadge count={tempCount} tone="temp" />
                    ) : null}
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
            ) : null}

            {available.hum ? (
              <LayerIconRow
                id="unified-hum-sublayers"
                label="습도 레이어"
                staggerIndex={groupOrder.indexOf("hum")}
                phase={rootPhase}
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
                    {layers.hum ? (
                      <LayerCountBadge count={humCount} tone="hum" />
                    ) : null}
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
            ) : null}

            {available.motors ? (
              <LayerIconRow
                id="unified-motor-sublayers"
                label="모터 레이어"
                staggerIndex={groupOrder.indexOf("motors")}
                phase={rootPhase}
                items={[
                  <IconTipButton
                    key="motor-main"
                    label={
                      layers.motors ? "모터 그래프 끄기" : "모터 그래프 켜기"
                    }
                    pressed={layers.motors}
                    on={layers.motors}
                    tone="motor"
                    onClick={() => onToggleLayer("motors")}
                  >
                    <Fan className="size-4 md:size-5" aria-hidden />
                    {layers.motors ? (
                      <LayerCountBadge count={motorCount} tone="motor" />
                    ) : null}
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
            ) : null}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
