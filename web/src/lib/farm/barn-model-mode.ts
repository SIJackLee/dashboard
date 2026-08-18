import type { BarnModelRoomPlan } from "@/lib/farm/barn-model-prefs";

export type BarnPlaceDraft = {
  stallTyCode: string;
  stallNo: string;
  plan: BarnModelRoomPlan;
  label: string;
};

export type BarnModelViewMode =
  | {
      kind: "field";
      roofFocusId: string | null;
      fieldTrendTy: string | null;
    }
  | { kind: "placing"; draft: BarnPlaceDraft }
  | { kind: "edit"; fillEditId: string | null }
  | { kind: "entrance"; barnId: string; settled: boolean };

export type BarnModelViewState = {
  mode: BarnModelViewMode;
  selectedBarnId: string | null;
  paletteOpen: boolean;
};

export type BarnModelViewAction =
  | { type: "escape" }
  | { type: "openEntrance"; barnId: string }
  | { type: "entranceArrived" }
  | { type: "backToField" }
  | { type: "toggleEdit" }
  | { type: "startPlacing"; draft: BarnPlaceDraft }
  | { type: "cancelPlacing" }
  | { type: "placed"; barnId: string }
  | { type: "setFillEdit"; barnId: string | null }
  | { type: "focusBarn"; barnId: string }
  | { type: "clearRoofFocus" }
  | { type: "toggleTrend"; stallTyCode: string; barnId: string }
  | { type: "selectBarn"; barnId: string | null }
  | { type: "deleteBarn"; barnId: string }
  | { type: "setPaletteOpen"; open: boolean };

export const BARN_MODEL_VIEW_INIT: BarnModelViewState = {
  mode: { kind: "field", roofFocusId: null, fieldTrendTy: null },
  selectedBarnId: null,
  paletteOpen: false,
};

function fieldMode(
  roofFocusId: string | null = null,
  fieldTrendTy: string | null = null,
): BarnModelViewMode {
  return { kind: "field", roofFocusId, fieldTrendTy };
}

export function barnModelShot(
  mode: BarnModelViewMode,
): "roof" | "entrance" {
  return mode.kind === "entrance" ? "entrance" : "roof";
}

export function barnModelYardEditing(mode: BarnModelViewMode): boolean {
  return mode.kind === "edit";
}

export function barnModelPlacing(
  mode: BarnModelViewMode,
): BarnPlaceDraft | null {
  return mode.kind === "placing" ? mode.draft : null;
}

export function barnModelFillEditId(mode: BarnModelViewMode): string | null {
  return mode.kind === "edit" ? mode.fillEditId : null;
}

export function barnModelRoofFocusId(mode: BarnModelViewMode): string | null {
  return mode.kind === "field" ? mode.roofFocusId : null;
}

export function barnModelFieldTrendTy(mode: BarnModelViewMode): string | null {
  return mode.kind === "field" ? mode.fieldTrendTy : null;
}

export function barnModelEntranceSettled(mode: BarnModelViewMode): boolean {
  return mode.kind === "entrance" && mode.settled;
}

export function reduceBarnModelView(
  state: BarnModelViewState,
  action: BarnModelViewAction,
): BarnModelViewState {
  const { mode } = state;

  switch (action.type) {
    case "escape": {
      if (mode.kind === "placing") {
        return { ...state, mode: fieldMode() };
      }
      if (mode.kind === "edit" && mode.fillEditId) {
        return { ...state, mode: { kind: "edit", fillEditId: null } };
      }
      if (mode.kind === "edit") {
        return { ...state, mode: fieldMode() };
      }
      if (mode.kind === "field" && mode.fieldTrendTy) {
        return { ...state, mode: { ...mode, fieldTrendTy: null } };
      }
      if (mode.kind === "field" && mode.roofFocusId) {
        return { ...state, mode: { ...mode, roofFocusId: null } };
      }
      if (mode.kind === "entrance") {
        return { ...state, mode: fieldMode() };
      }
      return state;
    }
    case "openEntrance":
      return {
        mode: { kind: "entrance", barnId: action.barnId, settled: false },
        selectedBarnId: action.barnId,
        paletteOpen: false,
      };
    case "entranceArrived":
      if (mode.kind !== "entrance") return state;
      return { ...state, mode: { ...mode, settled: true } };
    case "backToField":
      return { ...state, mode: fieldMode() };
    case "toggleEdit":
      if (mode.kind === "edit") {
        return { ...state, mode: fieldMode() };
      }
      return { ...state, mode: { kind: "edit", fillEditId: null } };
    case "startPlacing":
      return {
        ...state,
        mode: { kind: "placing", draft: action.draft },
        selectedBarnId: null,
      };
    case "cancelPlacing":
      if (mode.kind !== "placing") return state;
      return { ...state, mode: fieldMode() };
    case "placed":
      return {
        ...state,
        mode: fieldMode(),
        selectedBarnId: action.barnId,
      };
    case "setFillEdit":
      if (mode.kind !== "edit") return state;
      return { ...state, mode: { kind: "edit", fillEditId: action.barnId } };
    case "focusBarn":
      if (mode.kind !== "field") return state;
      return {
        ...state,
        selectedBarnId: action.barnId,
        mode: { ...mode, roofFocusId: action.barnId },
      };
    case "clearRoofFocus":
      if (mode.kind !== "field") return state;
      return { ...state, mode: { ...mode, roofFocusId: null } };
    case "toggleTrend":
      if (mode.kind !== "field") return state;
      return {
        ...state,
        selectedBarnId: action.barnId,
        mode: {
          ...mode,
          fieldTrendTy:
            mode.fieldTrendTy === action.stallTyCode
              ? null
              : action.stallTyCode,
        },
      };
    case "selectBarn": {
      if (mode.kind === "placing") return state;
      if (!action.barnId) {
        return {
          ...state,
          selectedBarnId: null,
          mode: mode.kind === "entrance" ? fieldMode() : mode,
        };
      }
      return { ...state, selectedBarnId: action.barnId };
    }
    case "deleteBarn": {
      const selectedBarnId =
        state.selectedBarnId === action.barnId ? null : state.selectedBarnId;
      if (mode.kind === "entrance") {
        return { ...state, selectedBarnId, mode: fieldMode() };
      }
      if (mode.kind === "field" && mode.roofFocusId === action.barnId) {
        return {
          ...state,
          selectedBarnId,
          mode: { ...mode, roofFocusId: null },
        };
      }
      if (mode.kind === "edit" && mode.fillEditId === action.barnId) {
        return {
          ...state,
          selectedBarnId,
          mode: { kind: "edit", fillEditId: null },
        };
      }
      return { ...state, selectedBarnId };
    }
    case "setPaletteOpen":
      return { ...state, paletteOpen: action.open };
    default: {
      const _never: never = action;
      return _never;
    }
  }
}
