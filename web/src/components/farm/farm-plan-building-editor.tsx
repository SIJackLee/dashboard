"use client";

import { RotateCcw } from "lucide-react";
import { BarnModelFillCard } from "@/components/farm/farm-barn-model-fill-card";
import type { BarnModelFill } from "@/lib/farm/barn-model-dim";
import type { BarnModelFillPatch } from "@/lib/farm/barn-model-prefs";
import { barnModelHud } from "@/lib/farm/barn-model-hud";
import { dashboardElevation, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

const ACTION_BTN =
  "inline-flex items-center justify-center gap-1 rounded-md px-2.5 text-xs font-medium leading-none";

export function FarmPlanBuildingEditor({
  fill,
  dirty,
  placed,
  variant = "overlay",
  onFillChange,
  onRevert,
  onPlace,
  onDelete,
}: {
  fill: BarnModelFill;
  dirty: boolean;
  placed: boolean;
  /** overlay = PC 독 옆 카드. sheet = 모바일 바텀시트 안. */
  variant?: "overlay" | "sheet";
  onFillChange: (patch: BarnModelFillPatch) => void;
  onRevert: () => void;
  onPlace: () => void;
  onDelete: () => void;
}) {
  const sheet = variant === "sheet";
  const actionBtn = sheet ? "h-11 min-h-11" : "h-8";
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        sheet
          ? "w-full"
          : cn(
              dashboardElevation.overlay,
              "w-max max-w-[min(22rem,calc(100vw-2rem))] p-2",
            ),
      )}
      data-testid="farm-plan-building-editor"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <BarnModelFillCard
        chrome={false}
        touchTargets={sheet}
        fill={fill}
        onChange={onFillChange}
      />
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        {placed ? (
          <button
            type="button"
            className={cn(
              barnModelHud.btn,
              ACTION_BTN,
              actionBtn,
              motionClass.microInteractive,
            )}
            onClick={onDelete}
          >
            삭제
          </button>
        ) : null}
        <button
          type="button"
          aria-label="되돌리기"
          disabled={!dirty}
          className={cn(
            barnModelHud.btn,
            motionClass.microInteractive,
            ACTION_BTN,
            actionBtn,
            "disabled:pointer-events-none disabled:opacity-40",
          )}
          onClick={onRevert}
        >
          <RotateCcw
            className="size-3.5"
            strokeWidth={dashboardUi.iconStroke}
          />
          되돌리기
        </button>
        <button
          type="button"
          className={cn(
            ACTION_BTN,
            actionBtn,
            motionClass.microInteractive,
            "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={onPlace}
        >
          {placed ? "적용" : "배치하기"}
        </button>
      </div>
    </div>
  );
}
