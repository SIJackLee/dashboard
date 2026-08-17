"use client";

import { getStallTypeName } from "@/lib/data/stall-type";
import type { BarnReading } from "@/lib/data/iot";
import {
  defaultBarnModelPlan,
  findPlacedBarnId,
  isBarnSlotPlaced,
  readingsForStallType,
  typeControllerCount,
  type BarnModelFarmSlot,
} from "@/lib/farm/barn-model-layout";
import type { BarnModelPlacedBarn, BarnModelRoomPlan } from "@/lib/farm/barn-model-prefs";
import { cn } from "@/lib/utils";

export type BarnPlaceDraft = {
  stallTyCode: string;
  stallNo: string;
  plan: BarnModelRoomPlan;
  label: string;
};

function BarnPlanThumb({
  plan,
  className,
}: {
  plan: BarnModelRoomPlan;
  className?: string;
}) {
  const rows = Math.max(plan.left, plan.right, 1);
  return (
    <div
      className={cn("flex h-8 w-10 shrink-0 items-stretch gap-px", className)}
      aria-hidden
    >
      <div className="flex flex-1 flex-col-reverse gap-px">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={`l-${i}`}
            className={cn(
              "min-h-0 flex-1 rounded-[1px]",
              i < plan.left ? "bg-foreground/70" : "bg-muted",
            )}
          />
        ))}
      </div>
      <div className="w-1 rounded-[1px] bg-muted-foreground/35" />
      <div className="flex flex-1 flex-col-reverse gap-px">
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={`r-${i}`}
            className={cn(
              "min-h-0 flex-1 rounded-[1px]",
              i < plan.right ? "bg-foreground/70" : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function draftKey(d: Pick<BarnPlaceDraft, "stallTyCode" | "stallNo">): string {
  return `${d.stallTyCode}:${d.stallNo}`;
}

function groupFarmSlots(slots: BarnModelFarmSlot[]): {
  stallTyCode: string;
  items: BarnModelFarmSlot[];
}[] {
  const groups: { stallTyCode: string; items: BarnModelFarmSlot[] }[] = [];
  for (const slot of slots) {
    const last = groups[groups.length - 1];
    if (last && last.stallTyCode === slot.stallTyCode) {
      last.items.push(slot);
    } else {
      groups.push({ stallTyCode: slot.stallTyCode, items: [slot] });
    }
  }
  return groups;
}

export function FarmBarnModelPalette({
  slots,
  placed,
  placing,
  readings,
  onPick,
  onCancel,
  onOpenPlaced,
}: {
  slots: BarnModelFarmSlot[];
  placed: Pick<BarnModelPlacedBarn, "id" | "stallTyCode" | "stallNo">[];
  placing: BarnPlaceDraft | null;
  readings: BarnReading[];
  onPick: (draft: BarnPlaceDraft) => void;
  onCancel: () => void;
  onOpenPlaced?: (barnId: string) => void;
}) {
  const groups = groupFarmSlots(slots);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <p className="px-0.5 text-[11px] font-medium text-muted-foreground">
        이 농장 축사
      </p>
      {groups.length === 0 ? (
        <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">
          LIVE 축사유형·번호가 없습니다.
        </p>
      ) : (
        <div className="grid gap-2">
          {groups.map((group) => {
            const typeCount = typeControllerCount(
              readingsForStallType(group.stallTyCode, readings),
            );
            const unplaced = group.items.filter(
              (t) => !isBarnSlotPlaced(t.stallTyCode, t.stallNo, placed),
            );
            const placedItems = group.items.filter((t) =>
              isBarnSlotPlaced(t.stallTyCode, t.stallNo, placed),
            );
            return (
              <div key={group.stallTyCode} className="grid gap-1">
                <div className="flex items-center gap-1.5 px-0.5">
                  <BarnPlanThumb plan={defaultBarnModelPlan(group.stallTyCode)} />
                  <p className="text-[10px] font-medium text-muted-foreground">
                    {getStallTypeName(group.stallTyCode)}
                    {typeCount > 0 ? ` · ${typeCount}대` : ""}
                  </p>
                </div>
                {[...unplaced, ...placedItems].map((t) => {
                  const placedAlready = isBarnSlotPlaced(
                    t.stallTyCode,
                    t.stallNo,
                    placed,
                  );
                  const placedId = findPlacedBarnId(
                    placed,
                    t.stallTyCode,
                    t.stallNo,
                  );
                  const active =
                    placing != null && draftKey(placing) === draftKey(t);
                  return (
                    <button
                      key={draftKey(t)}
                      type="button"
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs",
                        placedAlready && "opacity-70",
                        active
                          ? "border-foreground bg-background"
                          : "border-transparent bg-muted/50 hover:bg-muted",
                      )}
                      onClick={() => {
                        if (placedAlready) {
                          if (placedId) onOpenPlaced?.(placedId);
                          return;
                        }
                        if (active) onCancel();
                        else onPick(t);
                      }}
                    >
                      <BarnPlanThumb plan={t.plan} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{t.stallNo}</span>
                        {!placedAlready ? (
                          <span className="text-[10px] text-muted-foreground">
                            {typeCount > 0
                              ? `${typeCount}대 · 놓기`
                              : `왼쪽 ${t.plan.left} · 오른쪽 ${t.plan.right}`}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
