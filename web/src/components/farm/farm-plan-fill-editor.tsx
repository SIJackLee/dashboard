"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FarmPlanCorridorSketch } from "@/components/farm/farm-plan-corridor";
import {
  planFromFill,
  BARN_MODEL_BANKS,
  type BarnModelBanks,
} from "@/lib/farm/barn-model-dim";
import { dashboardReadout, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

function BanksGlyph({ banks }: { banks: BarnModelBanks }) {
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

function CountChip({
  value,
  max,
  onCommit,
}: {
  value: number;
  max: number;
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
    onCommit(Math.min(max, Math.max(1, Math.round(n))));
  };
  return (
    <input
      aria-label="칸 수"
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={cn(
        dashboardReadout.value,
        "h-7 w-8 rounded-sm border bg-popover px-0.5 text-center outline-none",
      )}
    />
  );
}

const HUD_BTN =
  "inline-flex items-center justify-center rounded-md ring-1 ring-foreground/30 bg-transparent text-foreground/80 hover:bg-foreground/10 hover:text-foreground";

/** 모델 방 편집과 같은 열 그림·칸 스테퍼. 치수(m) 입력은 없음. */
export function FarmPlanFillEditor({
  banks,
  cells,
  maxCells,
  onBanks,
  onCells,
  layout = "stack",
}: {
  banks: BarnModelBanks;
  cells: number;
  maxCells: number;
  onBanks: (n: BarnModelBanks) => void;
  onCells: (n: number) => void;
  layout?: "stack" | "row";
}) {
  const plan = planFromFill(banks, cells);
  const banksRow = (
    <div className="flex flex-col items-center gap-1">
      {[BARN_MODEL_BANKS.slice(0, 3), BARN_MODEL_BANKS.slice(3)].map(
        (row, rowIdx) => (
          <div key={rowIdx} className="flex justify-center gap-1">
            {row.map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n}열`}
                aria-pressed={banks === n}
                className={cn(
                  motionClass.microInteractive,
                  "flex h-8 min-w-9 items-center justify-center rounded-md px-1.5",
                  banks === n
                    ? "bg-primary text-primary-foreground ring-1 ring-primary"
                    : cn(HUD_BTN, "h-8 min-w-9 text-foreground/70"),
                )}
                onClick={() => onBanks(n)}
              >
                <BanksGlyph banks={n} />
              </button>
            ))}
          </div>
        ),
      )}
    </div>
  );
  const cellsCol = (
    <div className="flex w-8 flex-col items-stretch gap-0.5">
      <button
        type="button"
        aria-label="칸 늘리기"
        className={cn(
          HUD_BTN,
          motionClass.microInteractive,
          "h-5 w-full rounded-sm",
        )}
        onClick={() => onCells(Math.min(maxCells, cells + 1))}
      >
        <ChevronUp className="size-3.5" strokeWidth={dashboardUi.iconStroke} />
      </button>
      <CountChip value={cells} max={maxCells} onCommit={onCells} />
      <button
        type="button"
        aria-label="칸 줄이기"
        className={cn(
          HUD_BTN,
          motionClass.microInteractive,
          "h-5 w-full rounded-sm",
        )}
        onClick={() => onCells(Math.max(1, cells - 1))}
      >
        <ChevronDown
          className="size-3.5"
          strokeWidth={dashboardUi.iconStroke}
        />
      </button>
    </div>
  );
  if (layout === "row") {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        {banksRow}
        {cellsCol}
        <FarmPlanCorridorSketch plan={plan} banks={banks} size="sm" />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2.5">
      {banksRow}
      <div className="flex items-center gap-2">
        {cellsCol}
        <FarmPlanCorridorSketch plan={plan} banks={banks} size="lg" />
      </div>
    </div>
  );
}
