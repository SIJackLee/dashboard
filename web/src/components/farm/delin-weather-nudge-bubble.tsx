"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { unpackWeatherNudge } from "@/lib/weather-control/unpack-recommendation";
import type { WeatherNudgeView } from "@/lib/weather-control/weather-nudge-view";
import {
  dashboardAriaShell,
  dashboardHubSurface,
  dashboardUi,
} from "@/lib/ui/dashboard-page-ui";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

const STALE_APPLY_MESSAGE =
  "조건이 바뀌어 권장을 적용할 수 없습니다. 잠시 후 다시 확인해 주세요.";

const PANEL_INSET = 12;
const HANDLE_SIZE = "2.5rem";

type NudgeActions = {
  busy: boolean;
  applyError: string | null;
  dismiss: () => void;
  apply: () => void;
};

type NudgePanelProps = {
  nudge: WeatherNudgeView;
  canCommand: boolean;
  onDismiss: () => void;
  onApplied?: (commandId: string) => void;
};

type ThermoBlock = WeatherNudgeView["current"];

function fmtTemp(c: number): string {
  return `${c.toFixed(1).replace(/\.0$/, "")}°C`;
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

function ThermoSettingBlock({
  label,
  tone,
  values,
}: {
  label: string;
  tone: "neutral" | "primary";
  values: ThermoBlock;
}) {
  const rows = [
    { key: "목표 온도", value: fmtTemp(values.setpointTemp) },
    { key: "최저 환기", value: fmtPct(values.minVentPct) },
    { key: "최고 환기", value: fmtPct(values.maxVentPct) },
  ] as const;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        tone === "primary"
          ? "border-primary/30 bg-primary/5"
          : "border-border/80 bg-muted/20",
      )}
    >
      <p
        className={cn(
          "mb-2 text-[length:var(--density-readout-label)] font-semibold tracking-wide",
          tone === "primary" ? "text-primary" : "text-foreground",
        )}
      >
        {label}
      </p>
      <dl className="space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-3 text-[length:var(--density-meta-md)] leading-snug"
          >
            <dt className="shrink-0 text-muted-foreground">{row.key}</dt>
            <dd
              className={cn(
                "min-w-0 text-right font-medium tabular-nums",
                tone === "primary" ? "text-primary" : "text-foreground",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function useDelinWeatherNudgeActions({
  nudge,
  canCommand,
  onDismiss,
  onApplied,
}: NudgePanelProps): NudgeActions & { unpacked: ReturnType<typeof unpackWeatherNudge> } {
  const [busy, setBusy] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const unpacked = unpackWeatherNudge(nudge);

  const dismiss = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/weather-control/dismiss", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nudge.id }),
      });
    } catch {
      // optimistic hide even on failure
    }
    onDismiss();
  }, [busy, nudge.id, onDismiss]);

  const apply = useCallback(async () => {
    if (busy || !canCommand) return;
    setBusy(true);
    setApplyError(null);
    try {
      const res = await fetch("/api/weather-control/approve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nudge.id }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        commandId?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setApplyError(
          json.message ??
            (json.error === "stale_conditions"
              ? STALE_APPLY_MESSAGE
              : "권장 적용에 실패했습니다. 잠시 후 다시 시도해 주세요."),
        );
        return;
      }
      if (json.commandId) {
        onApplied?.(json.commandId);
      }
      onDismiss();
    } catch {
      setApplyError("권장 적용에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }, [busy, canCommand, nudge.id, onApplied, onDismiss]);

  return { busy, applyError, dismiss, apply, unpacked };
}

function DelinWeatherRecommendActions({
  canCommand,
  busy,
  applyError,
  onApply,
  onDismiss,
  className,
}: {
  canCommand: boolean;
  busy: boolean;
  applyError: string | null;
  onApply: () => void;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {applyError ? (
        <p
          className="text-[length:var(--density-meta)] text-status-warn"
          role="alert"
        >
          {applyError}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={!canCommand || busy}
          title={canCommand ? undefined : "명령 권한이 필요합니다"}
          className={cn(
            "inline-flex min-h-9 flex-1 items-center justify-center rounded-lg bg-primary px-3 py-2 text-[length:var(--density-meta-md)] font-medium text-primary-foreground",
            (!canCommand || busy) && "opacity-50",
            motionClass.microInteractive,
          )}
          onClick={onApply}
        >
          {busy ? "적용 중…" : "적용"}
        </button>
        <button
          type="button"
          disabled={busy}
          className={cn(
            "inline-flex min-h-9 flex-1 items-center justify-center rounded-lg border px-3 py-2 text-[length:var(--density-meta-md)] font-medium text-foreground",
            motionClass.microInteractive,
          )}
          onClick={onDismiss}
        >
          무시
        </button>
      </div>
    </div>
  );
}

function DelinWeatherRecommendBody({
  nudge,
  unpacked,
  applyError,
}: {
  nudge: WeatherNudgeView;
  unpacked: ReturnType<typeof unpackWeatherNudge>;
  applyError: string | null;
}) {
  return (
    <div className="space-y-3 text-[length:var(--density-meta-md)] leading-relaxed text-foreground">
      <p className="break-keep">{unpacked.headline}</p>
      {unpacked.contextLine ? (
        <p className="text-[length:var(--density-meta)] leading-relaxed text-muted-foreground">
          {unpacked.contextLine}
        </p>
      ) : null}

      <div className="space-y-2">
        <ThermoSettingBlock label="현재 설정" tone="neutral" values={nudge.current} />
        <ThermoSettingBlock label="권장 설정" tone="primary" values={nudge.proposed} />
      </div>

      <p className="text-[length:var(--density-meta)] leading-relaxed text-muted-foreground">
        {unpacked.actionLine}
      </p>

      {applyError ? (
        <p
          className="text-[length:var(--density-meta)] text-status-warn"
          role="alert"
        >
          {applyError}
        </p>
      ) : null}
    </div>
  );
}

/** 데스크톱 DELIN 탭 — 우측 인라인 추천 패널 */
export function DelinWeatherRecommendInline({
  nudge,
  canCommand,
  onDismiss,
  onApplied,
  className,
  variant = "rail",
}: NudgePanelProps & {
  className?: string;
  /** rail: 좁은 사이드 · split: 50% 열 */
  variant?: "rail" | "split";
}) {
  const { busy, applyError, dismiss, apply, unpacked } =
    useDelinWeatherNudgeActions({ nudge, canCommand, onDismiss, onApplied });
  const split = variant === "split";

  return (
    <aside
      className={cn(
        split
          ? cn(
              dashboardAriaShell.metricsPanel,
              "flex h-full min-h-0 w-full min-w-0 flex-col",
            )
          : dashboardAriaShell.metricsPanel,
        !split &&
          "relative z-[2] min-h-0 w-full shrink-0 md:w-[min(38%,17rem)] md:self-stretch",
        split && "relative z-[2]",
        motionClass.enterFade,
        className,
      )}
      aria-labelledby="delin-weather-nudge-title-inline"
      data-testid="delin-weather-recommend-inline"
    >
      <div
        className={cn(
          "flex shrink-0 items-start justify-between gap-2 pb-2.5",
          split ? "border-b border-border/60" : "border-b border-border/60",
        )}
      >
        <p
          id="delin-weather-nudge-title-inline"
          className={cn(
            "min-w-0 flex-1 font-semibold leading-snug text-primary",
            split
              ? "text-base md:text-[length:var(--density-section-md)]"
              : "text-[length:var(--density-meta-md)]",
          )}
        >
          [DELIN 추천 설정]
        </p>
        <button
          type="button"
          aria-label="닫기"
          disabled={busy}
          className={cn(
            "shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground",
            motionClass.microInteractive,
          )}
          onClick={() => void dismiss()}
        >
          <X className={dashboardUi.iconSm} strokeWidth={dashboardUi.iconStroke} />
        </button>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <DelinWeatherRecommendBody
          nudge={nudge}
          unpacked={unpacked}
          applyError={applyError}
        />
      </div>

      <DelinWeatherRecommendActions
        canCommand={canCommand}
        busy={busy}
        applyError={null}
        onApply={() => void apply()}
        onDismiss={() => void dismiss()}
        className={cn(
          "mt-3 shrink-0 border-t border-border/60 pt-3",
          split && "md:mt-4",
        )}
      />
    </aside>
  );
}

/** 말하기/결과면 — 한 줄 축소 */
export function DelinWeatherRecommendStrip({
  nudge,
  className,
  style,
  onExpand,
}: {
  nudge: WeatherNudgeView;
  className?: string;
  style?: CSSProperties;
  onExpand?: () => void;
}) {
  const unpacked = unpackWeatherNudge(nudge);
  const Comp = onExpand ? "button" : "div";

  return (
    <Comp
      type={onExpand ? "button" : undefined}
      style={style}
      className={cn(
        "relative z-[2] flex min-h-9 w-full items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2 text-left",
        onExpand && motionClass.microInteractive,
        className,
      )}
      data-testid="delin-weather-recommend-strip"
      {...(onExpand
        ? {
            onClick: onExpand,
            "aria-label": "DELIN 추천 설정 펼치기",
          }
        : {})}
    >
      <span className="shrink-0 text-[length:var(--density-meta)] font-semibold text-primary">
        [DELIN 추천 설정]
      </span>
      <span className="min-w-0 truncate text-[length:var(--density-meta-md)] text-foreground">
        {unpacked.headline}
      </span>
      {onExpand ? (
        <ChevronLeft className="ml-auto size-4 shrink-0 text-primary" aria-hidden />
      ) : null}
    </Comp>
  );
}

/** 모바일 — 우측 사이드 패널 + 핸들 (집계 범위 추적 없음) */
export function DelinWeatherNudgeMobile({
  nudge,
  canCommand,
  onDismiss,
  onApplied,
  compact = false,
}: NudgePanelProps & { compact?: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [insetTop, setInsetTop] = useState(64);
  const [open, setOpen] = useState(false);
  const { busy, applyError, dismiss, apply, unpacked } =
    useDelinWeatherNudgeActions({ nudge, canCommand, onDismiss, onApplied });
  const snapshotKey = `${nudge.id}:${nudge.proposed.setpointTemp}:${nudge.proposed.minVentPct}:${nudge.proposed.maxVentPct}`;
  const [appliedSnapshot, setAppliedSnapshot] = useState(snapshotKey);

  if (appliedSnapshot !== snapshotKey) {
    setAppliedSnapshot(snapshotKey);
    setOpen(false);
  }

  useLayoutEffect(() => {
    const header = document.querySelector("[data-app-header]");
    const sync = () => {
      const bottom = header?.getBoundingClientRect().bottom ?? 56;
      setInsetTop(bottom + PANEL_INSET);
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  const panelStyle = {
    top: insetTop,
    right: PANEL_INSET,
    maxHeight: `calc(100dvh - ${insetTop + PANEL_INSET}px)`,
    ["--delin-nudge-handle" as string]: HANDLE_SIZE,
  };

  if (!open) {
    if (compact) {
      return (
        <DelinWeatherRecommendStrip
          nudge={nudge}
          className="fixed inset-x-0 z-30 border-x-0"
          style={{
            top: insetTop,
          }}
          onExpand={() => setOpen(true)}
        />
      );
    }

    return (
      <button
        type="button"
        data-testid="delin-weather-nudge-bubble"
        data-collapsed="true"
        className={cn(
          "fixed z-30 inline-flex size-[var(--delin-nudge-handle)] items-center justify-center rounded-lg border border-primary/25 shadow-md",
          dashboardHubSurface.well,
          motionClass.microHover,
        )}
        style={panelStyle}
        aria-label="DELIN 추천 설정 펼치기"
        aria-expanded={false}
        aria-controls="delin-weather-nudge-body"
        onClick={() => setOpen(true)}
      >
        <ChevronLeft className="size-4 text-primary" aria-hidden />
        <span className="sr-only">DELIN 추천 설정</span>
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby="delin-weather-nudge-title"
      aria-live="polite"
      data-testid="delin-weather-nudge-bubble"
      data-collapsed="false"
      className={cn(
        "fixed z-40 flex w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-primary/25 shadow-lg",
        dashboardHubSurface.well,
        motionClass.ariaReplyIn,
      )}
      style={{
        ...panelStyle,
        bottom: PANEL_INSET,
      }}
    >
      <div className="flex w-[var(--delin-nudge-handle)] shrink-0 flex-col border-r border-border/60">
        <button
          type="button"
          className={cn(
            "inline-flex size-[var(--delin-nudge-handle)] items-center justify-center text-muted-foreground hover:text-foreground",
            motionClass.microHover,
          )}
          aria-expanded
          aria-controls="delin-weather-nudge-body"
          aria-label="DELIN 추천 설정 접기"
          data-testid="delin-weather-nudge-toggle"
          onClick={() => setOpen(false)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>

      <aside
        id="delin-weather-nudge-body"
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5">
          <p
            id="delin-weather-nudge-title"
            className="min-w-0 flex-1 text-[length:var(--density-meta-md)] font-semibold leading-snug text-primary"
          >
            [DELIN 추천 설정]
          </p>
          <button
            type="button"
            aria-label="닫기"
            disabled={busy}
            className={cn(
              "shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground",
              motionClass.microInteractive,
            )}
            onClick={() => void dismiss()}
          >
            <X className={dashboardUi.iconSm} strokeWidth={dashboardUi.iconStroke} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <DelinWeatherRecommendBody
            nudge={nudge}
            unpacked={unpacked}
            applyError={applyError}
          />
        </div>

        <DelinWeatherRecommendActions
          canCommand={canCommand}
          busy={busy}
          applyError={null}
          onApply={() => void apply()}
          onDismiss={() => void dismiss()}
          className="shrink-0 border-t border-border/60 px-3 py-3"
        />
      </aside>
    </div>
  );
}

/** @deprecated 모바일 전용 — DelinWeatherNudgeMobile 사용 */
export const DelinWeatherNudgeBubble = DelinWeatherNudgeMobile;
