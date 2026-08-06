"use client";

import { useEffect, useRef, useState } from "react";
import type { BarnReading } from "@/lib/data/iot";
import {
  motionDuration,
  motionStaggerStepMs,
} from "@/lib/ui/motion-tokens";

export type FieldListFilterPhase = "idle" | "exiting" | "entering";

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
  const [displayRows, setDisplayRows] = useState(rows);
  const [phase, setPhase] = useState<FieldListFilterPhase>("idle");
  const [enterEpoch, setEnterEpoch] = useState(0);
  const [committedKey, setCommittedKey] = useState(filterKey);
  const pendingRowsRef = useRef(rows);
  const bootRef = useRef(true);

  pendingRowsRef.current = rows;

  useEffect(() => {
    if (bootRef.current) {
      bootRef.current = false;
      setDisplayRows(rows);
      setCommittedKey(filterKey);
      return;
    }
    if (filterKey === committedKey) return;

    let cancelled = false;
    let enterTimer = 0;
    setPhase("exiting");

    const exitTimer = window.setTimeout(() => {
      if (cancelled) return;
      const next = pendingRowsRef.current;
      setDisplayRows(next);
      setCommittedKey(filterKey);
      setEnterEpoch((n) => n + 1);
      setPhase("entering");
      const staggerTail =
        Math.min(12, Math.max(0, next.length - 1)) * motionStaggerStepMs;
      enterTimer = window.setTimeout(() => {
        if (!cancelled) setPhase("idle");
      }, motionDuration.moderate + staggerTail);
    }, motionDuration.exit);

    return () => {
      cancelled = true;
      window.clearTimeout(exitTimer);
      window.clearTimeout(enterTimer);
    };
  }, [filterKey, committedKey]);

  useEffect(() => {
    if (phase !== "idle") return;
    if (filterKey !== committedKey) return;
    setDisplayRows(rows);
  }, [rows, phase, filterKey, committedKey]);

  return { displayRows, phase, enterEpoch };
}
