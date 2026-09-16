"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Bot } from "lucide-react";
import type { AlarmRow } from "@/lib/data/alarms";
import { mergeSituationAlarms } from "@/lib/data/alarms";
import type { BarnReading } from "@/lib/data/iot";
import { DELIN_NAME } from "@/lib/aria/aria-mode";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import {
  PIG_ENV_AGE_DECLINE,
  PIG_ENV_AGE_PROMPT,
  delinExplainSituationAlarms,
  pigEnvAdviceListPreview,
  pigEnvAdviceStallTyCode,
  pigEnvAgeAdviceLines,
  pigEnvAgeFollowupOpen,
} from "@/lib/farm/pig-env-recommend";
import { useFarmLiveRefreshOptional } from "@/lib/navigation/farm-live-refresh";
import {
  EMPTY_SITUATION_ALARMS,
  useShellAlarms,
} from "@/lib/navigation/shell-live-alarms-store";
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
  /** SSR 종 목록. LIVE 스토어가 있으면 그걸 우선. */
  alarms?: AlarmRow[];
};

/** 현장·차트 우측 하단 — 종(이상상황) 해설. 적용·음성 없음. */
export function DelinEnvBadge({
  readings,
  stallTyCode = null,
  alarms = EMPTY_SITUATION_ALARMS,
}: Props) {
  const liveAlarms = useShellAlarms(alarms);
  const liveRefresh = useFarmLiveRefreshOptional();
  const alarmSettings = liveRefresh?.slice.controller?.alarmSettings;
  const advice = useMemo(() => {
    const inbox =
      liveAlarms.length > 0
        ? liveAlarms
        : mergeSituationAlarms([], readings, alarmSettings);
    return delinExplainSituationAlarms(inbox, readings, stallTyCode);
  }, [liveAlarms, readings, stallTyCode, alarmSettings]);
  const ageStallTy = useMemo(
    () => pigEnvAdviceStallTyCode(readings, stallTyCode),
    [readings, stallTyCode],
  );
  const ageFollowup = pigEnvAgeFollowupOpen(advice.tier, ageStallTy);
  const ageLines = useMemo(
    () => (ageFollowup ? pigEnvAgeAdviceLines(ageStallTy) : []),
    [ageFollowup, ageStallTy],
  );
  const danger = advice.tier === "offline" || advice.tier === "alarm";
  const adviceKey = `${advice.stallLabel ?? ""}:${advice.tier}:${advice.summary}`;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [ageStep, setAgeStep] = useState<"ask" | "age" | "declined">("ask");
  const [ageStepKey, setAgeStepKey] = useState(adviceKey);
  if (ageStepKey !== adviceKey) {
    setAgeStepKey(adviceKey);
    setAgeStep("ask");
  }
  const open = advice.offBand
    ? dismissedKey !== adviceKey
    : dismissedKey === `open:${adviceKey}`;
  const compact = useHydrationSafeDashboardCompact();
  const docked = !open;
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
        compact ? "bottom-3" : "bottom-4 right-4",
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
          {open && ageFollowup ? (
            <div className="mt-2 border-t border-border/70 pt-2">
              {ageStep === "ask" ? (
                <>
                  <p
                    className="text-[length:var(--density-meta)] leading-snug text-foreground break-keep"
                    data-testid="delin-env-age-prompt"
                  >
                    {PIG_ENV_AGE_PROMPT}
                  </p>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <button
                      type="button"
                      className="rounded-md border border-border bg-background px-2 py-1 text-[length:var(--density-meta)] text-muted-foreground hover:bg-muted/40"
                      data-testid="delin-env-age-decline"
                      onClick={() => setAgeStep("declined")}
                    >
                      아니요
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-primary/40 bg-primary px-2 py-1 text-[length:var(--density-meta)] font-medium text-primary-foreground hover:bg-primary/90"
                      data-testid="delin-env-age-accept"
                      onClick={() => setAgeStep("age")}
                    >
                      네
                    </button>
                  </div>
                </>
              ) : null}
              {ageStep === "age" ? (
                <ul
                  className="list-disc space-y-1 pl-4 text-[length:var(--density-meta)] leading-snug text-muted-foreground break-keep"
                  data-testid="delin-env-age-lines"
                >
                  {ageLines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
              {ageStep === "declined" ? (
                <p
                  className="text-[length:var(--density-meta)] leading-snug text-muted-foreground break-keep"
                  data-testid="delin-env-age-declined"
                >
                  {PIG_ENV_AGE_DECLINE}
                </p>
              ) : null}
            </div>
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
              ? `${DELIN_NAME} 이상상황 해설 열기, 안내 ${noticeCount}건`
              : `${DELIN_NAME} 이상상황 해설 열기`
            : `${DELIN_NAME} 이상상황 해설`
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
