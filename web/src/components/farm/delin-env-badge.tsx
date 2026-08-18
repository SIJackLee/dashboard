"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Bot } from "lucide-react";
import type { BarnReading } from "@/lib/data/iot";
import { DELIN_NAME } from "@/lib/aria/aria-mode";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import {
  pigEnvAdviceCopy,
  pigEnvFocusReadings,
  pigEnvTypeVerdicts,
} from "@/lib/farm/pig-env-recommend";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

function delinBadgeHostSnapshot(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("[data-viewport-preview]") ??
    document.body
  );
}

type Props = {
  readings: BarnReading[];
  /** 축사유형 코드. 없으면 농장 전체에서 가장 나쁜 유형. */
  stallTyCode?: string | null;
};

/** 현장·차트·모델 우측 하단 — 권장표 말풍선. 적용·음성 없음. */
export function DelinEnvBadge({ readings, stallTyCode = null }: Props) {
  const verdicts = useMemo(
    () => pigEnvTypeVerdicts(pigEnvFocusReadings(readings, stallTyCode)),
    [readings, stallTyCode],
  );
  const advice = useMemo(() => pigEnvAdviceCopy(verdicts), [verdicts]);
  const adviceKey = `${advice.stallLabel ?? ""}:${advice.offBand}:${advice.summary}`;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const open = advice.offBand
    ? dismissedKey !== adviceKey
    : dismissedKey === `open:${adviceKey}`;
  const compact = useHydrationSafeDashboardCompact();
  const host = useSyncExternalStore(
    () => () => {},
    delinBadgeHostSnapshot,
    () => null,
  );

  if (!host) return null;

  return createPortal(
    <div
      className={cn(
        "pointer-events-none absolute z-[50] flex max-w-[min(20rem,calc(100%-1.5rem))] flex-col items-end gap-2",
        compact ? "bottom-[5.25rem] right-3" : "bottom-4 right-4",
      )}
      data-testid="delin-env-badge-root"
    >
      {open ? (
        <div
          className={cn(
            "pointer-events-auto w-full rounded-xl border bg-card/95 p-3 shadow-[var(--surface-shadow-tile)] backdrop-blur-md",
            advice.offBand
              ? "border-[color-mix(in_oklch,var(--status-warn)_40%,var(--border))]"
              : "border-primary/25",
            motionClass.enterFade,
          )}
          role="status"
          id="delin-env-badge-bubble"
          data-testid="delin-env-badge-bubble"
        >
          <p className="text-[length:var(--density-readout-label)] font-medium tracking-[var(--tracking-readout-label)] text-primary/70">
            {DELIN_NAME}
          </p>
          <p
            className={cn(
              "mt-1 text-[length:var(--density-meta)] leading-snug break-keep",
              advice.offBand
                ? "text-[var(--status-warn)]"
                : "text-foreground",
            )}
          >
            {advice.summary}
          </p>
          {advice.detail ? (
            <p className="mt-1.5 text-[length:var(--density-meta)] leading-snug text-muted-foreground break-keep">
              {advice.detail}
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        className={cn(
          "pointer-events-auto inline-flex items-center gap-2 rounded-full border bg-card/95 px-3.5 py-2.5 text-sm font-medium shadow-[var(--surface-shadow-tile)] backdrop-blur-md",
          advice.offBand
            ? "border-[color-mix(in_oklch,var(--status-warn)_45%,var(--border))] text-[var(--status-warn)]"
            : "border-primary/30 text-primary",
          "hover:bg-muted/40",
          motionClass.microInteractive,
        )}
        aria-expanded={open}
        aria-controls={open ? "delin-env-badge-bubble" : undefined}
        aria-label={`${DELIN_NAME} 권장 환경`}
        onClick={() => {
          if (advice.offBand) {
            setDismissedKey((prev) => (prev === adviceKey ? null : adviceKey));
          } else {
            setDismissedKey((prev) =>
              prev === `open:${adviceKey}` ? null : `open:${adviceKey}`,
            );
          }
        }}
        data-testid="delin-env-badge"
        data-tour-id="delin-env-badge"
      >
        <Bot className="size-4" aria-hidden />
        {DELIN_NAME}
      </button>
    </div>,
    host,
  );
}
