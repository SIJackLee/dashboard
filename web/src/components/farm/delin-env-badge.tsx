"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Bot } from "lucide-react";
import type { BarnReading } from "@/lib/data/iot";
import { DELIN_NAME } from "@/lib/aria/aria-mode";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import {
  pigEnvAdviceListPreview,
  pigEnvBadgeAdvice,
} from "@/lib/farm/pig-env-recommend";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

function delinBadgeHostSnapshot(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>("[data-delin-badge-host]") ??
    document.querySelector<HTMLElement>("[data-viewport-preview]") ??
    document.body
  );
}

const dockShift =
  "transition-[right] duration-motion-moderate ease-[var(--motion-ease-standard)] motion-reduce:transition-none";
const dockChip =
  "transition-[padding,gap,color,background-color,border-color,opacity,box-shadow] duration-motion-moderate ease-[var(--motion-ease-standard)] motion-reduce:transition-none";
const dockLabel =
  "transition-[max-width,opacity] duration-motion-moderate ease-[var(--motion-ease-standard)] motion-reduce:transition-none";

type Props = {
  readings: BarnReading[];
  /** 축사유형 코드. 없으면 농장 전체에서 가장 나쁜 유형. */
  stallTyCode?: string | null;
  /** 차트 브러시 위로 띄움 (모바일). 하단 탭은 호스트가 이미 제외. */
  liftAboveBrush?: boolean;
};

/** 현장·차트·모델 우측 하단 — 권장표·경보·통신두절 말풍선. 적용·음성 없음. */
export function DelinEnvBadge({
  readings,
  stallTyCode = null,
  liftAboveBrush = false,
}: Props) {
  const advice = useMemo(
    () => pigEnvBadgeAdvice(readings, stallTyCode),
    [readings, stallTyCode],
  );
  const danger = advice.tier === "offline" || advice.tier === "alarm";
  const adviceKey = `${advice.stallLabel ?? ""}:${advice.tier}:${advice.summary}`;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const open = advice.offBand
    ? dismissedKey !== adviceKey
    : dismissedKey === `open:${adviceKey}`;
  const compact = useHydrationSafeDashboardCompact();
  const docked = compact && !open;
  const noticeCount = advice.offBand ? advice.noticeCount : 0;
  const showNotice = docked && noticeCount > 0;
  const listPreview = pigEnvAdviceListPreview(advice.items);
  const noticeLabel = noticeCount > 9 ? "9+" : String(noticeCount);
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
        compact
          ? liftAboveBrush
            ? "bottom-[6.75rem]"
            : "bottom-3"
          : "bottom-4 right-4",
        compact && (docked ? (showNotice ? "right-1.5" : "right-0") : "right-3"),
        compact && dockShift,
      )}
      data-testid="delin-env-badge-root"
      data-delin-badge-docked={docked ? "true" : undefined}
      data-delin-badge-notice={showNotice ? noticeLabel : undefined}
    >
      {open ? (
        <div
          className={cn(
            "pointer-events-auto w-full rounded-xl border bg-card/95 p-3 shadow-[var(--surface-shadow-tile)] backdrop-blur-md",
            danger
              ? "border-[color-mix(in_oklch,var(--status-danger)_45%,var(--border))]"
              : advice.offBand
                ? "border-[color-mix(in_oklch,var(--status-warn)_40%,var(--border))]"
                : "border-primary/25",
            motionClass.enterFade,
          )}
          role="status"
          id="delin-env-badge-bubble"
          data-testid="delin-env-badge-bubble"
        >
          <p className="text-[length:var(--density-readout-label)] font-medium tracking-[var(--tracking-readout-label)] text-primary">
            {DELIN_NAME}
          </p>
          <p
            className={cn(
              "mt-1 text-[length:var(--density-meta)] leading-snug break-keep",
              danger
                ? "text-[var(--status-danger)]"
                : advice.offBand
                  ? "text-[var(--status-warn)]"
                  : "text-foreground",
            )}
          >
            {advice.summary}
          </p>
          {listPreview.shown.length > 0 ? (
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[length:var(--density-meta)] leading-snug text-muted-foreground break-keep">
              {listPreview.shown.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {listPreview.extraCount > 0 ? (
            <p className="mt-1 text-[length:var(--density-meta)] leading-snug text-muted-foreground break-keep">
              외 {listPreview.extraCount}건
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="relative">
      <button
        type="button"
        className={cn(
          "pointer-events-auto inline-flex h-10 min-w-10 items-center overflow-hidden rounded-full border bg-card/95 text-sm font-medium shadow-[var(--surface-shadow-tile)] backdrop-blur-md",
          docked ? "justify-center gap-0 px-2.5" : "gap-2 px-3.5",
          "border-primary/35 text-primary",
          "hover:bg-muted/40",
          dockChip,
        )}
        aria-expanded={open}
        aria-controls={open ? "delin-env-badge-bubble" : undefined}
        aria-label={
          docked
            ? showNotice
              ? `${DELIN_NAME} 권장 환경 열기, 안내 ${noticeCount}건`
              : `${DELIN_NAME} 권장 환경 열기`
            : `${DELIN_NAME} 권장 환경`
        }
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
        <Bot className="size-4 shrink-0" aria-hidden />
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap",
            docked ? "max-w-0 opacity-0" : "max-w-[5rem] opacity-100",
            dockLabel,
          )}
          aria-hidden={docked || undefined}
        >
          {DELIN_NAME}
        </span>
      </button>
      {showNotice ? (
        <span
          className={cn(
            "pointer-events-none absolute -top-1 -right-0.5 z-[1] inline-flex min-w-4 items-center justify-center rounded-full px-1",
            "text-[0.625rem] font-semibold leading-none tabular-nums text-white",
            "h-4",
            danger
              ? "bg-[var(--status-danger)]"
              : "bg-[var(--status-warn)]",
            motionClass.enterFade,
          )}
          aria-hidden
          data-testid="delin-env-badge-notice"
        >
          {noticeLabel}
        </span>
      ) : null}
      </div>
    </div>,
    host,
  );
}
