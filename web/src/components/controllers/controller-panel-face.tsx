"use client";

import { useCallback, useRef, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Droplets,
  Fan,
  GripVertical,
  Loader2,
  Minus,
  Plus,
  Power,
  Save,
  Thermometer,
  Wind,
} from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { ControllerListPanel } from "@/components/controllers/controller-list-panel";
import { ControllerNameLabel } from "@/components/common/controller-name-label";
import { useControllerMeta } from "@/components/controllers/controller-meta-provider";
import { useDisplayEnabled } from "@/components/display/display-settings-provider";
import { Button } from "@/components/ui/button";
import type { ControllerReading } from "@/lib/data/iot";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  pipelineDetailMessage,
  settingsSourceLabel,
  SLIDER_VALUE_SLOT_MIN_H,
  UNKNOWN_SETTINGS_HINT,
} from "@/lib/ui/controller-labels";
import {
  formatMenuValue,
  MENU_STEPS,
  PANEL_MENU_ITEMS,
  type PanelMenuId,
} from "@/lib/controllers/controller-panel-map";
import { useControllerPanel } from "./use-controller-panel";
import { cn } from "@/lib/utils";
import { ctrlUi } from "@/lib/ui/controller-page-ui";
import {
  isReadingOnline,
  sensorValueForDisplay,
} from "@/lib/data/reading-display";

function operationPct(reading?: ControllerReading): number {
  if (!reading) return 0;
  const vals = [reading.fanSupply, reading.fanExhaust, reading.fanIntake].filter(
    (v): v is number => v != null
  );
  if (vals.length === 0) return 0;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.max(0, Math.min(100, Math.round(avg)));
}

function PanelMenuIcon({
  menu,
  className,
}: {
  menu: PanelMenuId;
  className?: string;
}) {
  const iconClass = cn(ctrlUi.iconMd, "text-primary", className);
  if (menu === "setpoint" || menu === "deviation") {
    return <Thermometer className={iconClass} aria-hidden />;
  }
  return <Fan className={iconClass} aria-hidden />;
}

function formatMenuDelta(menu: PanelMenuId, current: number, target: number): string {
  const cfg = MENU_STEPS[menu];
  const diff = target - current;
  if (diff === 0) return "";
  const sign = diff > 0 ? "+" : "";
  const n =
    cfg.decimals === 0
      ? String(Math.round(diff))
      : (Math.round(diff * 10) / 10).toFixed(cfg.decimals);
  return cfg.unit === "℃" ? `${sign}${n}℃` : `${sign}${n}%`;
}

function SettingDeltaDisplay({
  menu,
  current,
  target,
}: {
  menu: PanelMenuId;
  current: number | null;
  target: number;
}) {
  const changed = current == null || current !== target;
  const delta =
    current != null && changed ? formatMenuDelta(menu, current, target) : "";

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className={ctrlUi.valueBox}>
        <p className={cn(ctrlUi.label, "leading-none")}>현재</p>
        <p className={cn("mt-1", ctrlUi.value)}>
          {current != null ? formatMenuValue(menu, current) : "--"}
        </p>
      </div>
      <ArrowRight className={cn(ctrlUi.iconSm, "text-muted-foreground")} aria-hidden />
      <div
        className={cn(
          changed ? ctrlUi.valueBoxPrimary : ctrlUi.valueBox,
          !changed && "opacity-90"
        )}
      >
        <p
          className={cn(
            ctrlUi.label,
            "leading-none",
            changed ? "text-primary" : "text-muted-foreground"
          )}
        >
          변경
        </p>
        <p
          className={cn(
            "mt-1",
            ctrlUi.value,
            changed ? "text-primary" : "text-foreground"
          )}
        >
          {formatMenuValue(menu, target)}
        </p>
      </div>
      {delta ? (
        <span className={ctrlUi.deltaBadge}>{delta}</span>
      ) : (
        <span className={cn(ctrlUi.label, "text-muted-foreground")}>변경 없음</span>
      )}
    </div>
  );
}

function fmtPct(value: number | null | undefined): string {
  return value != null ? `${Math.round(value)}%` : "--";
}

function fmtTemp(value: number | null | undefined): string {
  return value != null ? `${value.toFixed(1)}℃` : "--";
}

type PanelControlProps = {
  reading?: ControllerReading;
  knownSettings: ControllerThermoSettings | null;
  latestCommand?: ThermoCommand | null;
  canCommand: boolean;
  controllerList?: ControllerReading[];
  selectedControllerKey?: string;
  onControllerSelect?: (key: string) => void;
  spLabel?: string;
};

function CommandPipelineStatus({
  command,
}: {
  command: ThermoCommand | null | undefined;
}) {
  if (!command) return null;

  const toneClass =
    command.status === "applied"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : command.status === "sent"
        ? "border-sky-200 bg-sky-50 text-sky-800"
        : command.status === "pending"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : command.status === "failed"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-border bg-muted/40 text-muted-foreground";

  const detail = pipelineDetailMessage(command.status, command.errorMsg);

  return (
    <div className={cn(ctrlUi.banner, "text-left", toneClass)}>
      <p className={ctrlUi.bannerTitle}>{commandStatusLabel(command.status)}</p>
      {detail ? (
        <p className={cn("mt-0.5", ctrlUi.label)}>{detail}</p>
      ) : null}
    </div>
  );
}

function LiveMetricTile({
  label,
  value,
  icon,
  large = false,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  large?: boolean;
}) {
  return (
    <div className={cn(ctrlUi.metricTile, "flex items-center gap-3 p-4 md:p-5")}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
          large ? "size-14 [&_svg]:size-9" : "size-12 [&_svg]:size-8"
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className={ctrlUi.label}>{label}</p>
        <p className={cn("mt-1 tabular-nums", large ? ctrlUi.valueLg : ctrlUi.value)}>
          {value}
        </p>
      </div>
    </div>
  );
}

function LiveMonitor({
  reading,
  opPct,
  powerOn,
}: {
  reading?: ControllerReading;
  opPct: number;
  powerOn: boolean;
}) {
  const online = isReadingOnline(reading?.status);

  return (
    <div className={ctrlUi.sectionMuted}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-2",
            ctrlUi.sectionTitle
          )}
        >
          <Activity className={cn(ctrlUi.iconMd, "text-primary")} aria-hidden />
          LIVE 모니터
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-2 text-2xl font-medium",
            reading && powerOn ? "text-emerald-600" : "text-muted-foreground"
          )}
        >
          <Power className={ctrlUi.iconMd} aria-hidden />
          POWER {reading ? (powerOn ? "ON" : "OFF") : "--"}
        </span>
      </div>

      <div className={cn("mt-3 grid grid-cols-3", ctrlUi.gridGap)}>
        <LiveMetricTile
          label="현재 온도"
          value={fmtTemp(sensorValueForDisplay(reading?.status, reading?.tempC))}
          icon={<Thermometer className="size-full" aria-hidden />}
          large
        />
        <LiveMetricTile
          label="습도"
          value={fmtPct(
            sensorValueForDisplay(reading?.status, reading?.humidityPct)
          )}
          icon={<Droplets className="size-full" aria-hidden />}
          large
        />
        <LiveMetricTile
          label="원동작"
          value={reading && online ? `${opPct}%` : "--"}
          icon={<Activity className="size-full" aria-hidden />}
          large
        />
      </div>

      <div className={cn("mt-3 grid grid-cols-3", ctrlUi.gridGap)}>
        <LiveMetricTile
          label="송풍"
          value={fmtPct(sensorValueForDisplay(reading?.status, reading?.fanSupply))}
          icon={<Wind className="size-full" aria-hidden />}
        />
        <LiveMetricTile
          label="배기"
          value={fmtPct(sensorValueForDisplay(reading?.status, reading?.fanExhaust))}
          icon={<Fan className="size-full" aria-hidden />}
        />
        <LiveMetricTile
          label="입기"
          value={fmtPct(sensorValueForDisplay(reading?.status, reading?.fanIntake))}
          icon={<Wind className="size-full" aria-hidden />}
        />
      </div>
    </div>
  );
}

function sliderPct(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function PanelSlider({
  menu,
  value,
  current,
  disabled,
  onChange,
}: {
  menu: PanelMenuId;
  value: number;
  current?: number | null;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const cfg = MENU_STEPS[menu];
  const fillPct = sliderPct(value, cfg.min, cfg.max);
  const currentPct =
    current != null ? sliderPct(current, cfg.min, cfg.max) : null;
  const tickCount = Math.floor((cfg.max - cfg.min) / cfg.step) + 1;

  return (
    <div
      className="ctrl-slider-wrap relative min-w-0 flex-1"
      data-menu={menu}
      style={{ "--slider-fill": `${fillPct}%` } as React.CSSProperties}
    >
      <div className="ctrl-slider-track" aria-hidden>
        {tickCount > 2 &&
          Array.from({ length: tickCount }, (_, i) => {
            if (i === 0 || i === tickCount - 1) return null;
            const left = (i / (tickCount - 1)) * 100;
            return (
              <span
                key={i}
                className="ctrl-slider-tick"
                style={{ left: `${left}%` }}
              />
            );
          })}
        <span className="ctrl-slider-fill" />
        {currentPct != null && current !== value && (
          <span
            className="ctrl-slider-current"
            style={{ left: `${currentPct}%` }}
          />
        )}
      </div>
      <input
        type="range"
        min={cfg.min}
        max={cfg.max}
        step={cfg.step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${PANEL_MENU_ITEMS.find((m) => m.id === menu)?.label} 슬라이더`}
        className={cn(ctrlUi.slider, "ctrl-range-enriched")}
        data-menu={menu}
      />
    </div>
  );
}

function DesktopSliderList({
  activeMenu,
  setActiveMenu,
  sliderValues,
  currentValues,
  isFieldChanged,
  disabled,
  onSetField,
  onNudge,
}: {
  activeMenu: PanelMenuId;
  setActiveMenu: (id: PanelMenuId) => void;
  sliderValues: Record<PanelMenuId, number>;
  currentValues: Record<PanelMenuId, number> | null;
  isFieldChanged: (menu: PanelMenuId) => boolean;
  disabled?: boolean;
  onSetField: (menu: PanelMenuId, value: number) => void;
  onNudge: (menu: PanelMenuId, dir: 1 | -1) => void;
}) {
  return (
    <div className={cn("hidden md:block", ctrlUi.section)}>
      <p className={ctrlUi.sectionTitle}>
        설정 편집 — 슬라이더 드래그 · ± 미세 조정
      </p>
      <div className={ctrlUi.sliderGrid}>
        {PANEL_MENU_ITEMS.map((item) => {
          const active = activeMenu === item.id;
          const value = sliderValues[item.id];
          const current = currentValues?.[item.id] ?? null;
          const changed = isFieldChanged(item.id);
          return (
            <div
              key={item.id}
              className={cn(
                ctrlUi.sliderCard,
                "transition-colors",
                active ? "border-primary/50 bg-primary/5" : "border-border",
                changed && "ring-1 ring-primary/20"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setActiveMenu(item.id)}
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 text-left hover:text-primary disabled:opacity-50",
                    ctrlUi.body,
                    active ? "font-semibold text-primary" : "font-medium",
                    !changed && "text-muted-foreground"
                  )}
                >
                  <PanelMenuIcon menu={item.id} />
                  {item.label}
                </button>
                <div className="shrink-0">
                  <SettingDeltaDisplay
                    menu={item.id}
                    current={current}
                    target={value}
                  />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <PanelSlider
                  menu={item.id}
                  value={value}
                  current={current}
                  disabled={disabled}
                  onChange={(v) => onSetField(item.id, v)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  className="size-11 shrink-0"
                  disabled={disabled}
                  aria-label={`${item.label} 내림`}
                  onClick={() => onNudge(item.id, -1)}
                >
                  <Minus className={ctrlUi.iconSm} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  className="size-11 shrink-0"
                  disabled={disabled}
                  aria-label={`${item.label} 올림`}
                  onClick={() => onNudge(item.id, 1)}
                >
                  <Plus className={ctrlUi.iconSm} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MobileSwipeEditor({
  activeMenu,
  setActiveMenu,
  sliderValues,
  currentValues,
  isFieldChanged,
  disabled,
  onSetField,
  onNudge,
}: {
  activeMenu: PanelMenuId;
  setActiveMenu: (id: PanelMenuId) => void;
  sliderValues: Record<PanelMenuId, number>;
  currentValues: Record<PanelMenuId, number> | null;
  isFieldChanged: (menu: PanelMenuId) => boolean;
  disabled?: boolean;
  onSetField: (menu: PanelMenuId, value: number) => void;
  onNudge: (menu: PanelMenuId, dir: 1 | -1) => void;
}) {
  const cfg = MENU_STEPS[activeMenu];
  const value = sliderValues[activeMenu];
  const current = currentValues?.[activeMenu] ?? null;
  const label = PANEL_MENU_ITEMS.find((m) => m.id === activeMenu)?.label ?? "";
  const changed = isFieldChanged(activeMenu);
  const swipeRef = useRef<HTMLDivElement>(null);

  const handleSwipePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      const el = swipeRef.current;
      if (!el) return;
      el.setPointerCapture(e.pointerId);
      const startY = e.clientY;
      const startVal = value;

      const onMove = (ev: PointerEvent) => {
        const dy = startY - ev.clientY;
        const units = Math.round(dy / 14);
        onSetField(activeMenu, startVal + units * cfg.step);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [activeMenu, cfg.step, disabled, onSetField, value]
  );

  return (
    <div className={cn("md:hidden", ctrlUi.section)}>
      <p className={ctrlUi.sectionTitle}>
        설정 편집 — 항목 선택 후 스와이프 존 드래그
      </p>

      <div className={cn("mt-3 flex flex-wrap", ctrlUi.chipStripGap)}>
        {PANEL_MENU_ITEMS.map((item) => {
          const itemChanged = isFieldChanged(item.id);
          return (
            <Button
              key={item.id}
              type="button"
              variant={activeMenu === item.id ? "default" : "outline"}
              disabled={disabled}
              onClick={() => setActiveMenu(item.id)}
              className={cn(
                ctrlUi.btnMenuTab,
                itemChanged &&
                  activeMenu !== item.id &&
                  "border-amber-400/70 text-amber-900 dark:text-amber-100"
              )}
            >
              {item.label}
              {itemChanged ? " · Δ" : null}
            </Button>
          );
        })}
      </div>

      <div className={cn("mt-3", ctrlUi.swipePanel)}>
        <p className={ctrlUi.sectionTitle}>{label}</p>
        <div
          className={cn(
            "mt-2 flex items-center justify-center",
            SLIDER_VALUE_SLOT_MIN_H
          )}
        >
          <SettingDeltaDisplay
            menu={activeMenu}
            current={current}
            target={value}
          />
        </div>
        <p
          className={cn(
            "mt-2",
            ctrlUi.valueLg,
            changed ? "text-primary" : "text-foreground"
          )}
        >
          {formatMenuValue(activeMenu, value)}
        </p>
        <p className={cn("mt-1", ctrlUi.label)}>
          {changed
            ? "큰 숫자 = 변경값 · 스와이프 존에서 조절"
            : "현재값 · 스와이프 존에서 조절"}
        </p>
      </div>

      <div
        ref={swipeRef}
        role="slider"
        aria-label={`${label} 조절`}
        aria-valuemin={cfg.min}
        aria-valuemax={cfg.max}
        aria-valuenow={value}
        className={cn(
          "mt-3 touch-none",
          ctrlUi.swipeZone,
          disabled ? "cursor-not-allowed opacity-50" : "cursor-ns-resize"
        )}
        onPointerDown={handleSwipePointerDown}
      >
        <p className={ctrlUi.sectionTitle}>스와이프 존</p>
        <div className="mt-1.5 flex items-center justify-center gap-2 text-muted-foreground">
          <ChevronUp className={ctrlUi.iconMd} aria-hidden />
          <GripVertical className={ctrlUi.iconMd} aria-hidden />
          <ChevronDown className={ctrlUi.iconMd} aria-hidden />
        </div>
        <p className={cn("mt-1.5", ctrlUi.label)}>이 영역만 위·아래 드래그</p>
      </div>

      <div className={cn("mt-3 flex justify-center", ctrlUi.chipStripGap)}>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onNudge(activeMenu, -1)}
          className={ctrlUi.btnMicro}
        >
          <Minus className={ctrlUi.iconSm} />
          미세
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => onNudge(activeMenu, 1)}
          className={ctrlUi.btnMicro}
        >
          <Plus className={ctrlUi.iconSm} />
          미세
        </Button>
      </div>
    </div>
  );
}

export function ControllerPanelFace({
  reading,
  knownSettings,
  latestCommand,
  canCommand,
  controllerList = [],
  selectedControllerKey,
  onControllerSelect,
  spLabel,
}: PanelControlProps) {
  const panel = useControllerPanel(reading, knownSettings, canCommand);
  const { resolveName } = useControllerMeta();
  const showControllerList = useDisplayEnabled("controller.controllerList");
  const showLiveMonitor = useDisplayEnabled("controller.liveMonitor");
  const showSliders = useDisplayEnabled("controller.sliders");
  const opPct = operationPct(reading);
  const powerOn = reading?.status === "normal" || reading?.status === "caution";
  const controlsDisabled = !reading || !canCommand || panel.pending;
  const saveDisabled =
    controlsDisabled || (panel.settingsKnown && !panel.hasChanges);

  return (
    <SectionCard
      size="lg"
      title="컨트롤러 패널"
      action={
        reading ? (
          <StatusBadge tone={reading.status} large />
        ) : (
          <StatusBadge tone="offline" label="--" large />
        )
      }
    >
      {showControllerList &&
      controllerList.length > 0 &&
      onControllerSelect ? (
        <div className="mb-3">
          <ControllerListPanel
            embedded
            items={controllerList}
            selectedKey={selectedControllerKey}
            onSelect={onControllerSelect}
            spLabel={spLabel}
          />
        </div>
      ) : !showControllerList ? null : (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <ControllerNameLabel
            className="text-base"
            name={
              reading
                ? resolveName(reading.controllerKey, reading.eqpmnNo)
                : null
            }
            label={reading?.label}
            stallNo={reading?.stallNo}
            eqpmnNo={reading?.eqpmnNo}
            controllerKey={reading?.controllerKey}
          />
        </div>
      )}

      <div className={ctrlUi.stack}>
        {showLiveMonitor ? (
          <LiveMonitor
            reading={reading}
            opPct={opPct}
            powerOn={powerOn}
          />
        ) : null}

        {showSliders ? (
          <>
            <DesktopSliderList
              activeMenu={panel.activeMenu}
              setActiveMenu={panel.setActiveMenu}
              sliderValues={panel.sliderValues}
              currentValues={panel.currentValues}
              isFieldChanged={panel.isFieldChanged}
              disabled={controlsDisabled}
              onSetField={panel.setField}
              onNudge={(menu, dir) => panel.adjust(dir, menu)}
            />

            <MobileSwipeEditor
              activeMenu={panel.activeMenu}
              setActiveMenu={panel.setActiveMenu}
              sliderValues={panel.sliderValues}
              currentValues={panel.currentValues}
              isFieldChanged={panel.isFieldChanged}
              disabled={controlsDisabled}
              onSetField={panel.setField}
              onNudge={(menu, dir) => panel.adjust(dir, menu)}
            />
          </>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={saveDisabled}
            onClick={panel.save}
            className={cn("w-full md:w-auto", ctrlUi.btnSave)}
          >
            {panel.pending ? (
              <>
                <Loader2 className={cn(ctrlUi.iconSm, "animate-spin")} />
                저장 중…
              </>
            ) : (
              <>
                <Save className={ctrlUi.iconSm} aria-hidden />
                저장
              </>
            )}
          </Button>
        </div>
      </div>

      <div className={cn("mt-3 space-y-2 text-center", ctrlUi.footer)}>
        <CommandPipelineStatus command={latestCommand} />
        <p>
          데스크톱: 슬라이더 드래그 · 모바일: 스와이프 존 드래그 · ± 미세 조정 후{" "}
          <strong className="text-foreground">저장</strong>
        </p>
        {panel.settingsKnown ? (
          <p className="text-emerald-700">
            설정값:{" "}
            {panel.settingsSource
              ? settingsSourceLabel(panel.settingsSource)
              : "설정값"}
            {panel.hasEdited && " · 수정됨 — 저장 필요"}
            {!panel.hasChanges && panel.settingsKnown && " · 변경 없음"}
          </p>
        ) : (
          <p className="text-amber-700">
            {UNKNOWN_SETTINGS_HINT}
          </p>
        )}
        {!canCommand && (
          <p className="text-amber-700">명령 권한이 없어 조작이 제한됩니다.</p>
        )}
        {panel.message && (
          <p
            className={
              panel.message.tone === "ok" ? "text-emerald-700" : "text-red-600"
            }
          >
            {panel.message.text}
          </p>
        )}
      </div>
    </SectionCard>
  );
}
