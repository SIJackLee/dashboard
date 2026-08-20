"use client";

import { Fragment } from "react";
import {
  aisleCountForBanks,
  BARN_MODEL_DIM,
  banksFromPlan,
  type BarnModelBanks,
} from "@/lib/farm/barn-model-dim";
import type { BarnSiteRoomPlan } from "@/lib/farm/barn-site-types";
import { cn } from "@/lib/utils";

function PenColumn({
  count,
  rows,
  emphasis,
}: {
  count: number;
  rows: number;
  emphasis?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col-reverse gap-px">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={cn(
            "min-h-[0.4rem] flex-1 rounded-[2px]",
            i < count
              ? emphasis
                ? "bg-primary/25 ring-1 ring-primary/40"
                : "border border-border bg-background"
              : "border border-transparent bg-muted/40",
          )}
        />
      ))}
    </div>
  );
}

function Aisle() {
  return (
    <div
      className="w-2 shrink-0 self-stretch rounded-[2px]"
      style={{ backgroundColor: BARN_MODEL_DIM.aisleHex }}
      aria-hidden
    />
  );
}

function roomsInBank(plan: BarnSiteRoomPlan, banks: BarnModelBanks, bank: number): number {
  if (banks === 1) return plan.left;
  if (banks === 2) return bank === 0 ? plan.left : plan.right;
  if (bank === 0) return plan.left;
  if (bank === banks - 1) return plan.right;
  return plan.mid ?? Math.max(plan.left, plan.right, 1);
}

/** 복도식 자동 평면. 칸에 센서는 없다. 열식은 1–5. */
export function FarmPlanCorridorSketch({
  plan,
  banks: banksProp,
  className,
  size = "sm",
}: {
  plan: BarnSiteRoomPlan;
  banks?: BarnModelBanks;
  className?: string;
  size?: "sm" | "lg";
}) {
  const banks = banksProp ?? banksFromPlan(plan);
  const aisleN = aisleCountForBanks(banks);
  const rows = Math.max(plan.left, plan.right, plan.mid ?? 0, 1);
  return (
    <div
      className={cn(
        "flex items-stretch gap-0.5",
        size === "lg" ? "h-40 w-[18rem]" : "h-24 w-full max-w-[16rem]",
        className,
      )}
      aria-hidden
    >
      {Array.from({ length: banks }, (_, bank) => (
        <Fragment key={bank}>
          <PenColumn
            count={roomsInBank(plan, banks, bank)}
            rows={rows}
            emphasis={size === "lg"}
          />
          {bank < aisleN ? <Aisle /> : null}
        </Fragment>
      ))}
    </div>
  );
}
