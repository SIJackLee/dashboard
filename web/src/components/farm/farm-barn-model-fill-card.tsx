"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { BARN_MODEL_DIM, type BarnModelFill } from "@/lib/farm/barn-model-dim";
import { barnModelHud } from "@/lib/farm/barn-model-hud";
import type { BarnModelFillPatch } from "@/lib/farm/barn-model-prefs";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const CHIP = barnModelHud.chip;
const HUD_BTN = barnModelHud.btn;

function MeterChip({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (n: number) => void;
}) {
  const source = value.toFixed(2);
  const [text, setText] = useState(source);
  const [prev, setPrev] = useState(source);
  if (source !== prev) {
    setPrev(source);
    setText(source);
  }
  const commit = () => {
    const n = Number(text.replace(",", ".").trim());
    if (!Number.isFinite(n)) {
      setText(source);
      return;
    }
    onCommit(n);
  };
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={CHIP}
    />
  );
}

function CountChip({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (n: number) => void;
}) {
  const source = String(value);
  const [text, setText] = useState(source);
  const [prev, setPrev] = useState(source);
  if (source !== prev) {
    setPrev(source);
    setText(source);
  }
  const commit = () => {
    const n = Number(text.trim());
    if (!Number.isFinite(n)) {
      setText(source);
      return;
    }
    onCommit(n);
  };
  return (
    <input
      aria-label="열당 갯수"
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={barnModelHud.count}
    />
  );
}

function DimLine({
  direction,
  span,
  label,
  value,
  onCommit,
}: {
  direction: "h" | "v";
  span: number;
  label: string;
  value: number;
  onCommit: (n: number) => void;
}) {
  const tick = "bg-foreground/50";
  const line = "bg-foreground/35";
  const chip = (
    <MeterChip label={label} value={value} onCommit={onCommit} />
  );
  if (direction === "h") {
    return (
      <div
        className="relative flex h-5 items-center justify-center overflow-visible"
        style={{ width: span }}
      >
        <span className={cn("absolute top-0.5 bottom-0.5 left-0 w-px", tick)} />
        <span className={cn("absolute top-0.5 bottom-0.5 right-0 w-px", tick)} />
        <span className={cn("absolute inset-x-0 top-1/2 h-px -translate-y-px", line)} />
        {chip}
      </div>
    );
  }
  return (
    <div
      className="relative flex w-9 items-center justify-center overflow-visible"
      style={{ height: span }}
    >
      <span className={cn("absolute left-1.5 right-1.5 top-0 h-px", tick)} />
      <span className={cn("absolute left-1.5 right-1.5 bottom-0 h-px", tick)} />
      <span className={cn("absolute top-0 bottom-0 left-1/2 w-px -translate-x-px", line)} />
      {chip}
    </div>
  );
}

function BanksGlyph({ banks }: { banks: 1 | 2 | 3 }) {
  const cols = banks * 2 - 1;
  return (
    <span className="flex h-5 items-stretch gap-px" aria-hidden>
      {Array.from({ length: cols }, (_, i) => (
        <span
          key={i}
          className={cn(
            "rounded-[1px]",
            i % 2 === 0 ? "w-2 bg-current" : "w-1 bg-current/35",
          )}
        />
      ))}
    </span>
  );
}

export function BarnModelFillCard({
  fill,
  open,
  dirty = false,
  onOpenChange,
  onRevert,
  onChange,
}: {
  fill: BarnModelFill;
  open: boolean;
  dirty?: boolean;
  onOpenChange: (open: boolean) => void;
  onRevert?: () => void;
  onChange: (patch: BarnModelFillPatch) => void;
}) {
  const planOpen = open;
  const roomH = 44;
  const roomW = Math.round(
    Math.min(64, Math.max(36, roomH * (fill.penDepth / fill.penAlong))),
  );
  const aisleW = Math.round(
    Math.min(56, Math.max(32, roomH * (fill.aisleW / fill.penAlong))),
  );

  return (
    <div
      className={cn(
        "w-max rounded-xl bg-transparent",
        planOpen ? "p-3 ring-1 ring-foreground/30" : "p-0",
      )}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={cn("flex items-center justify-center gap-1", planOpen && "mb-2.5")}>
        {planOpen ? (
          <button
            type="button"
            aria-label="되돌리기"
            disabled={!dirty}
            className={cn(
              HUD_BTN,
              "h-8 gap-1 px-2.5 text-xs font-medium",
              "disabled:pointer-events-none disabled:opacity-40",
            )}
            onClick={() => onRevert?.()}
          >
            <RotateCcw className="size-3.5" strokeWidth={dashboardUi.iconStroke} />
            되돌리기
          </button>
        ) : null}
        <button
          type="button"
          aria-expanded={planOpen}
          aria-label="방 편집"
          className={cn(
            "inline-flex h-8 items-center gap-1 px-2.5 text-xs font-medium",
            planOpen
              ? "rounded-md bg-primary text-primary-foreground ring-1 ring-primary"
              : cn(HUD_BTN, "h-8 gap-1 px-2.5 text-xs font-medium"),
          )}
          onClick={() => onOpenChange(!planOpen)}
        >
          방 편집
          {planOpen ? (
            <ChevronUp className="size-3.5" strokeWidth={dashboardUi.iconStroke} />
          ) : (
            <ChevronDown className="size-3.5" strokeWidth={dashboardUi.iconStroke} />
          )}
        </button>
      </div>

      {planOpen ? (
        <>
          <div className="mb-2.5 flex justify-center gap-1">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n}열`}
                aria-pressed={fill.banks === n}
                className={cn(
                  "flex h-8 min-w-9 items-center justify-center rounded-md px-1.5",
                  fill.banks === n
                    ? "bg-primary text-primary-foreground ring-1 ring-primary"
                    : cn(HUD_BTN, "h-8 min-w-9 text-foreground/70"),
                )}
                onClick={() => onChange({ banks: n })}
              >
                <BanksGlyph banks={n} />
              </button>
            ))}
          </div>

          <div className="flex items-start gap-2">
            <div
              className="flex flex-col items-center justify-center gap-0.5"
              style={{ height: roomH }}
            >
              <button
                type="button"
                aria-label="칸 늘리기"
                className={barnModelHud.stepper}
                onClick={() => onChange({ roomCount: fill.roomCount + 1 })}
              >
                <ChevronUp className="size-3.5" strokeWidth={dashboardUi.iconStroke} />
              </button>
              <CountChip
                value={fill.roomCount}
                onCommit={(n) => onChange({ roomCount: n })}
              />
              <button
                type="button"
                aria-label="칸 줄이기"
                className={barnModelHud.stepper}
                onClick={() => onChange({ roomCount: Math.max(1, fill.roomCount - 1) })}
              >
                <ChevronDown className="size-3.5" strokeWidth={dashboardUi.iconStroke} />
              </button>
            </div>

            <div className="flex flex-col items-stretch">
              <div className="flex items-stretch gap-1">
                <DimLine
                  direction="v"
                  span={roomH}
                  label="방 가로"
                  value={fill.penAlong}
                  onCommit={(n) => onChange({ penAlong: n })}
                />
                <div
                  className="rounded-sm bg-primary/25 ring-1 ring-primary/40"
                  style={{ width: roomW, height: roomH }}
                />
              </div>
              <div className="mt-1 flex items-center gap-1">
                <div className="w-9 shrink-0" aria-hidden />
                <DimLine
                  direction="h"
                  span={roomW}
                  label="방 세로"
                  value={fill.penDepth}
                  onCommit={(n) => onChange({ penDepth: n })}
                />
              </div>
            </div>

            <div className="flex flex-col items-stretch">
              <div
                className="rounded-sm"
                style={{
                  width: aisleW,
                  height: roomH,
                  backgroundColor: BARN_MODEL_DIM.aisleHex,
                }}
              />
              <div className="mt-1">
                <DimLine
                  direction="h"
                  span={aisleW}
                  label="복도 너비"
                  value={fill.aisleW}
                  onCommit={(n) => onChange({ aisleW: n })}
                />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
