"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  APPLY_QUEUE_STAGE_COUNT,
  type ApplyQueueChannelStripItem,
} from "@/lib/farm/apply-queue";
import { motionDuration } from "@/lib/ui/motion-tokens";
import { motionClass } from "@/lib/ui/motion-classes";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

function prefersStripReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function CoverApplyDonut({ spinning }: { spinning: boolean }) {
  return (
    <span
      className={cn(
        "size-3.5 shrink-0 rounded-full border-2 border-current border-t-transparent opacity-90 motion-reduce:animate-none",
        spinning && "animate-spin",
      )}
      aria-hidden
    />
  );
}

function CoverApplyCheck() {
  return (
    <Check
      className={cn("size-3.5 shrink-0", motionClass.enterFade)}
      strokeWidth={2.5}
      aria-hidden
    />
  );
}

function CoverApplyGauge({ filled }: { filled: number }) {
  const t = Math.max(0, Math.min(1, filled / APPLY_QUEUE_STAGE_COUNT));
  return (
    <span className="relative flex h-1.5 min-w-0">
      <span className="flex h-full w-full gap-0.5">
        {Array.from({ length: APPLY_QUEUE_STAGE_COUNT }, (_, index) => (
          <span
            key={index}
            className="min-w-0 flex-1 rounded-sm bg-current opacity-20"
          />
        ))}
      </span>
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-full origin-left rounded-sm bg-current opacity-90",
          "transition-transform duration-motion-moderate ease-[var(--motion-ease-standard)]",
          "motion-reduce:transition-none",
        )}
        style={{ transform: `scaleX(${t})` }}
      />
    </span>
  );
}

export function CoverChannelApplyStrip({
  items,
}: {
  items: ApplyQueueChannelStripItem[];
}) {
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const [gone, setGone] = useState<ReadonlySet<string>>(() => new Set());
  const holdTimers = useRef(new Map<string, number>());
  const exitTimers = useRef(new Map<string, number>());

  const confirmIds = useMemo(
    () =>
      items
        .filter((item) => item.stage === "확인")
        .map((item) => item.id)
        .sort()
        .join(","),
    [items],
  );
  const leavingSig = useMemo(() => [...leaving].sort().join(","), [leaving]);

  useEffect(() => {
    const ids = confirmIds.split(",").filter((id) => id.length > 0);
    const active = new Set(ids);
    const hold = prefersStripReducedMotion() ? 0 : motionDuration.emphasis;
    for (const [id, timer] of holdTimers.current) {
      if (active.has(id)) continue;
      window.clearTimeout(timer);
      holdTimers.current.delete(id);
    }
    for (const id of ids) {
      if (holdTimers.current.has(id)) continue;
      const timer = window.setTimeout(() => {
        holdTimers.current.delete(id);
        setLeaving((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }, hold);
      holdTimers.current.set(id, timer);
    }
  }, [confirmIds]);

  useEffect(() => {
    const ids = leavingSig.split(",").filter((id) => id.length > 0);
    const active = new Set(ids);
    const exitMs = prefersStripReducedMotion() ? 0 : motionDuration.exit;
    for (const [id, timer] of exitTimers.current) {
      if (active.has(id)) continue;
      window.clearTimeout(timer);
      exitTimers.current.delete(id);
    }
    for (const id of ids) {
      if (exitTimers.current.has(id)) continue;
      const timer = window.setTimeout(() => {
        exitTimers.current.delete(id);
        setGone((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
      }, exitMs);
      exitTimers.current.set(id, timer);
    }
  }, [leavingSig]);

  useEffect(() => {
    const hold = holdTimers.current;
    const exit = exitTimers.current;
    return () => {
      for (const timer of hold.values()) window.clearTimeout(timer);
      for (const timer of exit.values()) window.clearTimeout(timer);
      hold.clear();
      exit.clear();
    };
  }, []);

  const visible = items.filter((item) => !gone.has(item.id));
  if (visible.length === 0) return null;

  return (
    <span className="mt-2 flex w-full flex-col gap-1.5" aria-hidden>
      {visible.map((item) => {
        const confirmed = item.stage === "확인";
        return (
          <span
            key={item.id}
            className={cn(
              "grid grid-cols-[1rem_minmax(0,1fr)_1.25rem] items-center gap-1.5",
              leaving.has(item.id) && motionClass.exitFade,
            )}
          >
            <span
              className={cn(
                "font-semibold leading-none",
                dashboardTypography.envCoverMeta,
                "text-current",
              )}
            >
              {item.slot ?? "—"}
            </span>
            <CoverApplyGauge filled={item.filled} />
            <span className="flex justify-end text-current">
              {confirmed ? (
                <CoverApplyCheck />
              ) : (
                <CoverApplyDonut spinning={item.stage !== "실패"} />
              )}
            </span>
          </span>
        );
      })}
    </span>
  );
}
