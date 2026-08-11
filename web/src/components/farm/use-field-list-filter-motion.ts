"use client";

import { useEffect, useReducer, useRef } from "react";
import type { BarnReading } from "@/lib/data/iot";
import {
  motionDuration,
  motionStaggerStepMs,
} from "@/lib/ui/motion-tokens";

export type FieldListFilterPhase = "idle" | "exiting" | "entering";

type MotionState = {
  displayRows: BarnReading[];
  phase: FieldListFilterPhase;
  enterEpoch: number;
  committedKey: string;
};

type MotionAction =
  | { type: "sync_rows"; rows: BarnReading[] }
  | { type: "begin_exit" }
  | { type: "apply_filter"; rows: BarnReading[]; filterKey: string }
  | { type: "finish_enter" };

function motionReducer(state: MotionState, action: MotionAction): MotionState {
  switch (action.type) {
    case "sync_rows":
      return { ...state, displayRows: action.rows };
    case "begin_exit":
      return { ...state, phase: "exiting" };
    case "apply_filter":
      return {
        ...state,
        displayRows: action.rows,
        committedKey: action.filterKey,
        enterEpoch: state.enterEpoch + 1,
        phase: "entering",
      };
    case "finish_enter":
      return { ...state, phase: "idle" };
    default:
      return state;
  }
}

/**
 * 현장 좌측 축사 필터 — exit fade → rows 교체 → enter stagger.
 * filterKey 변경 시에만 재생. 동일 필터의 LIVE rows 갱신은 즉시 반영.
 */
export function useFieldListFilterMotion(
  filterKey: string,
  rows: BarnReading[],
): {
  displayRows: BarnReading[];
  phase: FieldListFilterPhase;
  enterEpoch: number;
} {
  const rowsRef = useRef(rows);

  useEffect(() => {
    rowsRef.current = rows;
  });

  const [state, dispatch] = useReducer(motionReducer, {
    displayRows: rows,
    phase: "idle",
    enterEpoch: 0,
    committedKey: filterKey,
  });

  if (
    state.phase === "idle" &&
    filterKey === state.committedKey &&
    state.displayRows !== rows
  ) {
    dispatch({ type: "sync_rows", rows });
  }

  if (filterKey !== state.committedKey && state.phase !== "exiting") {
    dispatch({ type: "begin_exit" });
  }

  useEffect(() => {
    if (state.phase !== "exiting") return;

    let cancelled = false;
    const exitTimer = window.setTimeout(() => {
      if (cancelled) return;
      dispatch({
        type: "apply_filter",
        rows: rowsRef.current,
        filterKey,
      });
    }, motionDuration.exit);

    return () => {
      cancelled = true;
      window.clearTimeout(exitTimer);
    };
  }, [state.phase, filterKey]);

  useEffect(() => {
    if (state.phase !== "entering") return;

    let cancelled = false;
    const staggerTail =
      Math.min(12, Math.max(0, state.displayRows.length - 1)) *
      motionStaggerStepMs;
    const enterTimer = window.setTimeout(() => {
      if (!cancelled) dispatch({ type: "finish_enter" });
    }, motionDuration.moderate + staggerTail);

    return () => {
      cancelled = true;
      window.clearTimeout(enterTimer);
    };
  }, [state.phase, state.enterEpoch, state.displayRows.length]);

  return {
    displayRows: state.displayRows,
    phase: state.phase,
    enterEpoch: state.enterEpoch,
  };
}
