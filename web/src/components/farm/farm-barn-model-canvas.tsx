"use client";

import type { BarnReading } from "@/lib/data/iot";
import {
  FarmBarnModelScene,
  type BarnModelOpenController,
} from "@/components/farm/farm-barn-model-scene";
import type { BarnModelLiveTrend } from "@/components/farm/farm-barn-model-live-hud";
import type {
  BarnModelCameraShot,
  BarnModelRoomPlan,
  BarnModelYard,
} from "@/lib/farm/barn-model-layout";

type Props = {
  yard: BarnModelYard;
  shot: BarnModelCameraShot;
  selectedBarnId: string | null;
  readings: BarnReading[];
  peekKey: string | null;
  onPeekKeyChange: (key: string) => void;
  liveTrend: BarnModelLiveTrend;
  editingBarnId?: string | null;
  onEditBarn?: (barnId: string) => void;
  onDeleteBarn?: (barnId: string) => void;
  onEntranceBarn?: (barnId: string) => void;
  onBackToField?: () => void;
  onPrevBarn?: () => void;
  onNextBarn?: () => void;
  onCycleType?: () => void;
  onPeekControllers?: () => void;
  highlightControllerKey?: string | null;
  onSelectBarn: (barnId: string) => void;
  onOpenController: (payload: BarnModelOpenController) => void;
  onMoveBarn?: (barnId: string, x: number, z: number) => void;
  onMoveBarnEnd?: () => void;
  placing?: boolean;
  placingDraft?: {
    plan: BarnModelRoomPlan;
    label: string;
    stallTyCode: string;
  } | null;
  onPlaceAt?: (x: number, z: number) => void;
  onRotateBarn?: (barnId: string, rotDeg: number) => void;
  onResizeBarn?: (
    barnId: string,
    plan: BarnModelRoomPlan,
    opts?: { pin?: "front" | "back" },
  ) => void;
};

export function FarmBarnModelCanvas(props: Props) {
  return <FarmBarnModelScene {...props} />;
}
