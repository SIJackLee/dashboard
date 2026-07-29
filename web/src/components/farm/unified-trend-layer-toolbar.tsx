"use client";

import type { ComponentType, ReactNode } from "react";
import {
  Activity,
  AreaChart,
  ArrowUpDown,
  CheckCheck,
  ChevronDown,
  Droplets,
  Fan,
  Layers2,
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
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type LayerChip = {
  id: UnifiedLayerId;
  label: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

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

/** 헤더 도구 버튼(size-9 / md:size-11)과 동일 크기 */
function iconBtnClass(on: boolean, muted = false) {
  return cn(
    "relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg md:size-11",
    motionClass.microInteractive,
    on
      ? "bg-muted text-foreground"
      : muted
        ? "text-muted-foreground/45 hover:text-muted-foreground"
        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  );
}

function IconTipButton({
  label,
  on,
  pressed,
  expanded,
  controls,
  muted,
  onClick,
  children,
}: {
  label: string;
  on?: boolean;
  pressed?: boolean;
  expanded?: boolean;
  controls?: string;
  muted?: boolean;
  onClick: () => void;
  children: ReactNode;
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
        className={iconBtnClass(active, muted)}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={10} className="z-[80]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * 차트 레이어 툴바 — ScopeBar 우측.
 * 부모=메뉴 펼침, 하위=본선 on/off + 분석 + 전체.
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
  const tempCount = TEMP_SUB_CHIPS.filter(
    (c) => available[c.id] && layers[c.id],
  ).length;
  const humCount = HUM_SUB_CHIPS.filter(
    (c) => available[c.id] && layers[c.id],
  ).length;
  const motorCount = MOTOR_SUB_CHIPS.filter(
    (c) => available[c.id] && layers[c.id],
  ).length;

  const renderSub = (chip: LayerChip) => {
    if (!available[chip.id]) return null;
    const on = layers[chip.id];
    const Icon = chip.Icon;
    return (
      <IconTipButton
        key={chip.id}
        label={chip.label}
        pressed={on}
        on={on}
        onClick={() => onToggleLayer(chip.id)}
      >
        <Icon className="size-4 md:size-5" aria-hidden />
      </IconTipButton>
    );
  };

  const flyout = (id: string, children: ReactNode) => (
    <div
      id={id}
      role="group"
      className="absolute right-0 top-[calc(100%+6px)] z-[70] flex items-center gap-0.5 rounded-lg border border-border/70 bg-popover p-1"
    >
      {children}
    </div>
  );

  return (
    <TooltipProvider delay={200}>
      <div
        className={cn(
          "relative inline-flex items-center gap-0.5",
          className,
        )}
        data-tour-id="unified-trend-layer-toolbar"
        aria-label="통합 추이 레이어"
      >
        {available.temp ? (
          <div className="relative">
            <IconTipButton
              label={`온도${layers.temp ? "" : " (숨김)"}`}
              on={layers.temp || tempMenuOpen}
              muted={!layers.temp && !tempMenuOpen}
              expanded={tempMenuOpen}
              controls="unified-temp-sublayers"
              onClick={() => {
                onTempMenuOpenChange(!tempMenuOpen);
                if (!tempMenuOpen) {
                  onHumMenuOpenChange(false);
                  onMotorMenuOpenChange(false);
                }
              }}
            >
              <Thermometer className="size-4 md:size-5" aria-hidden />
              {layers.temp && tempCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-foreground/80 text-[8px] font-semibold text-background md:size-4 md:text-[9px]">
                  {tempCount}
                </span>
              ) : null}
              <ChevronDown
                className={cn(
                  "pointer-events-none absolute bottom-0.5 size-2.5 opacity-50 transition-transform",
                  tempMenuOpen && "rotate-180",
                )}
                aria-hidden
              />
            </IconTipButton>
            {tempMenuOpen
              ? flyout(
                  "unified-temp-sublayers",
                  <>
                    <IconTipButton
                      label={layers.temp ? "온도 그래프 끄기" : "온도 그래프 켜기"}
                      pressed={layers.temp}
                      on={layers.temp}
                      onClick={() => onToggleLayer("temp")}
                    >
                      <Thermometer className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>
                    <IconTipButton
                      label="온도 전체 적용"
                      on={
                        layers.temp &&
                        TEMP_SUB_CHIPS.every(
                          (c) => !available[c.id] || layers[c.id],
                        )
                      }
                      onClick={() => onEnableGroupAll("temp")}
                    >
                      <CheckCheck className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>
                    {TEMP_SUB_CHIPS.map(renderSub)}
                  </>,
                )
              : null}
          </div>
        ) : null}

        {available.hum ? (
          <div className="relative">
            <IconTipButton
              label={`습도${layers.hum ? "" : " (숨김)"}`}
              on={layers.hum || humMenuOpen}
              muted={!layers.hum && !humMenuOpen}
              expanded={humMenuOpen}
              controls="unified-hum-sublayers"
              onClick={() => {
                onHumMenuOpenChange(!humMenuOpen);
                if (!humMenuOpen) {
                  onTempMenuOpenChange(false);
                  onMotorMenuOpenChange(false);
                }
              }}
            >
              <Droplets className="size-4 md:size-5" aria-hidden />
              {layers.hum && humCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-foreground/80 text-[8px] font-semibold text-background md:size-4 md:text-[9px]">
                  {humCount}
                </span>
              ) : null}
              <ChevronDown
                className={cn(
                  "pointer-events-none absolute bottom-0.5 size-2.5 opacity-50 transition-transform",
                  humMenuOpen && "rotate-180",
                )}
                aria-hidden
              />
            </IconTipButton>
            {humMenuOpen
              ? flyout(
                  "unified-hum-sublayers",
                  <>
                    <IconTipButton
                      label={layers.hum ? "습도 그래프 끄기" : "습도 그래프 켜기"}
                      pressed={layers.hum}
                      on={layers.hum}
                      onClick={() => onToggleLayer("hum")}
                    >
                      <Droplets className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>
                    <IconTipButton
                      label="습도 전체 적용"
                      on={
                        layers.hum &&
                        HUM_SUB_CHIPS.every(
                          (c) => !available[c.id] || layers[c.id],
                        )
                      }
                      onClick={() => onEnableGroupAll("hum")}
                    >
                      <CheckCheck className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>
                    {HUM_SUB_CHIPS.map(renderSub)}
                  </>,
                )
              : null}
          </div>
        ) : null}

        {available.motors ? (
          <div className="relative">
            <IconTipButton
              label={`모터${layers.motors ? "" : " (숨김)"}`}
              on={layers.motors || motorMenuOpen}
              muted={!layers.motors && !motorMenuOpen}
              expanded={motorMenuOpen}
              controls="unified-motor-sublayers"
              onClick={() => {
                onMotorMenuOpenChange(!motorMenuOpen);
                if (!motorMenuOpen) {
                  onTempMenuOpenChange(false);
                  onHumMenuOpenChange(false);
                }
              }}
            >
              <Fan className="size-4 md:size-5" aria-hidden />
              {layers.motors && motorCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-foreground/80 text-[8px] font-semibold text-background md:size-4 md:text-[9px]">
                  {motorCount}
                </span>
              ) : null}
              <ChevronDown
                className={cn(
                  "pointer-events-none absolute bottom-0.5 size-2.5 opacity-50 transition-transform",
                  motorMenuOpen && "rotate-180",
                )}
                aria-hidden
              />
            </IconTipButton>
            {motorMenuOpen
              ? flyout(
                  "unified-motor-sublayers",
                  <>
                    <IconTipButton
                      label={
                        layers.motors ? "모터 그래프 끄기" : "모터 그래프 켜기"
                      }
                      pressed={layers.motors}
                      on={layers.motors}
                      onClick={() => onToggleLayer("motors")}
                    >
                      <Fan className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>
                    <IconTipButton
                      label="모터 전체 적용"
                      on={
                        layers.motors &&
                        MOTOR_SUB_CHIPS.every(
                          (c) => !available[c.id] || layers[c.id],
                        )
                      }
                      onClick={() => onEnableGroupAll("motor")}
                    >
                      <CheckCheck className="size-4 md:size-5" aria-hidden />
                    </IconTipButton>
                    {MOTOR_SUB_CHIPS.map(renderSub)}
                  </>,
                )
              : null}
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
