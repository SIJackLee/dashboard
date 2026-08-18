import type { BarnReading } from "@/lib/data/iot";
import type {
  BarnModelCameraShot,
  BarnModelRoomPlan,
  BarnModelYard,
} from "@/lib/farm/barn-model-layout";
import type { BarnModelDimAxis } from "@/lib/farm/barn-model-dim";
import type { BarnModelFillPatch } from "@/lib/farm/barn-model-prefs";
import type { BarnModelLiveTrend } from "@/components/farm/farm-barn-model-live-hud";

export type BarnModelOpenController = {
  barnId: string;
  controllerKey: string;
};

export type BarnModelSceneProps = {
  yard: BarnModelYard;
  shot: BarnModelCameraShot;
  selectedBarnId: string | null;
  placing?: boolean;
  placingDraft?: {
    plan: BarnModelRoomPlan;
    label: string;
    stallTyCode: string;
  } | null;
  onSelectBarn: (barnId: string) => void;
  onOpenController: (payload: BarnModelOpenController) => void;
  onMoveBarn?: (barnId: string, x: number, z: number) => void;
  onRotateBarn?: (barnId: string, rotDeg: number) => void;
  onSetBarnShell?: (
    barnId: string,
    axis: BarnModelDimAxis,
    meters: number,
  ) => void;
  onSetBarnFill?: (barnId: string, patch: BarnModelFillPatch) => void;
  onMoveBarnEnd?: () => void;
  onPlaceAt?: (x: number, z: number) => void;
  readings?: BarnReading[];
  peekKey?: string | null;
  onPeekKeyChange?: (key: string) => void;
  liveTrend?: BarnModelLiveTrend;
  yardEditing?: boolean;
  onDeleteBarn?: (barnId: string) => void;
  onEntranceBarn?: (barnId: string) => void;
  onBackToField?: () => void;
  onPrevBarn?: () => void;
  onNextBarn?: () => void;
  onCycleType?: () => void;
  onPeekControllers?: () => void;
  highlightControllerKey?: string | null;
  onEntranceArrived?: () => void;
  roofFocusId?: string | null;
  onRoofFocusClear?: () => void;
  onCycleTypeBarn?: (barnId: string, dir: 1 | -1) => void;
  onOpenTrend?: (barnId: string) => void;
  fillEditId?: string | null;
  fillEditDirty?: boolean;
  onFillEditOpenChange?: (barnId: string, open: boolean) => void;
  onFillEditRevert?: () => void;
};
