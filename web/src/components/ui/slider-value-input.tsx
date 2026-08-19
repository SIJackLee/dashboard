"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";

export type SliderValueInputSize = "compact" | "dashboard";
export type SliderValueInputLayout = "inline" | "field";

const INLINE_SIZE_CLASS: Record<SliderValueInputSize, string> = {
  compact:
    "h-8 w-[3.5rem] shrink-0 border-input bg-background px-1.5 text-center text-sm font-semibold tabular-nums text-foreground shadow-sm md:h-8 md:w-16",
  dashboard:
    "h-9 w-[4.5rem] shrink-0 border-input bg-background px-2 text-center text-sm font-semibold tabular-nums text-foreground shadow-sm md:h-12 md:w-24 md:text-[1.75rem]",
};

const FIELD_SIZE_CLASS: Record<SliderValueInputSize, string> = {
  compact:
    "h-7 min-w-0 w-full border-0 bg-transparent px-0 text-left text-sm font-semibold tabular-nums text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0",
  dashboard:
    "h-9 min-w-0 w-full border-0 bg-transparent px-0 text-left text-base font-semibold tabular-nums text-foreground shadow-none focus-visible:border-transparent focus-visible:ring-0 md:h-11 md:text-xl",
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function snap(n: number, step: number) {
  const s = 1 / step;
  return Math.round(n * s) / s;
}

export function fmtSliderInputValue(value: number, step: number) {
  if (step >= 1) return String(Math.round(value));
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function parseDraft(raw: string): number | null {
  const t = raw.trim();
  if (!t || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

type SliderValueInputProps = {
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  "aria-label": string;
  disabled?: boolean;
  size?: SliderValueInputSize;
  /** 편차 등 — 입력 앞 시각 prefix */
  prefix?: string;
  /** inline = 축 한 줄 고정폭. field = 트랙 위 반반 라벨 박스 */
  layout?: SliderValueInputLayout;
  caption?: string;
  onCommit: (value: number) => void;
};

/** 슬라이더 축 숫자 입력 — 완성된 숫자는 타이핑 중 commit, Enter/blur 시 확정 */
export function SliderValueInput({
  value,
  min,
  max,
  step,
  unit,
  "aria-label": ariaLabel,
  disabled = false,
  size = "compact",
  prefix,
  layout = "inline",
  caption,
  onCommit,
}: SliderValueInputProps) {
  const focusedRef = useRef(false);
  const [draft, setDraft] = useState(() => fmtSliderInputValue(value, step));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(fmtSliderInputValue(value, step));
      setInvalid(false);
    }
  }, [value, step]);

  const revert = useCallback(() => {
    setDraft(fmtSliderInputValue(value, step));
    setInvalid(false);
  }, [value, step]);

  const commit = useCallback(() => {
    const parsed = parseDraft(draft);
    if (parsed === null) {
      revert();
      return;
    }
    const next = snap(clamp(parsed, min, max), step);
    onCommit(next);
    setDraft(fmtSliderInputValue(next, step));
    setInvalid(false);
  }, [draft, min, max, onCommit, revert, step]);

  /** 타이핑 중에도 dirty 반영 — blur 전 「적용」이 disabled로 남는 문제 방지 */
  const commitIfComplete = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t || t.endsWith(".") || t === "-" || t.endsWith("-")) return;
      const parsed = parseDraft(t);
      if (parsed === null) return;
      const next = snap(clamp(parsed, min, max), step);
      if (next !== value) onCommit(next);
    },
    [max, min, onCommit, step, value],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      revert();
      e.currentTarget.blur();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const prefixClass =
    size === "compact" ? "text-xs" : "text-sm md:text-xl";
  const unitClass =
    size === "compact" ? "text-[10px] md:text-xs" : "text-sm md:text-xl";

  const input = (
    <Input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      disabled={disabled}
      value={draft}
      uiSize="default"
      aria-invalid={invalid || undefined}
      className={cn(
        layout === "field" ? FIELD_SIZE_CLASS[size] : INLINE_SIZE_CLASS[size],
        invalid && "border-destructive",
      )}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onKeyDown={handleKeyDown}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^\d.-]/g, "");
        setDraft(cleaned);
        setInvalid(false);
        commitIfComplete(cleaned);
      }}
    />
  );

  const valueRow = (
    <div
      className={cn(
        "flex items-center gap-0.5",
        layout === "inline" ? "shrink-0" : "min-w-0 w-full",
      )}
    >
      {prefix ? (
        <span
          className={cn("tabular-nums text-muted-foreground", prefixClass)}
          aria-hidden
        >
          {prefix}
        </span>
      ) : null}
      {input}
      <span
        className={cn("shrink-0 tabular-nums text-muted-foreground", unitClass)}
        aria-hidden
      >
        {unit}
      </span>
    </div>
  );

  if (layout === "field") {
    return (
      <label
        className={cn(
          "min-w-0 rounded-lg border border-input bg-background px-2 py-1",
          invalid && "border-destructive",
          disabled && "opacity-50",
        )}
      >
        {caption ? (
          <span
            className="block text-[10px] leading-tight text-muted-foreground"
            aria-hidden
          >
            {caption}
          </span>
        ) : null}
        {valueRow}
      </label>
    );
  }

  return valueRow;
}

type SliderBoundFieldsProps = {
  low: number;
  high: number;
  lowMin: number;
  lowMax: number;
  highMin: number;
  highMax: number;
  step: number;
  unit: string;
  lowCaption: string;
  highCaption: string;
  lowAria: string;
  highAria: string;
  disabled?: boolean;
  size?: SliderValueInputSize;
  highPrefix?: string;
  domainText?: string;
  domainClassName?: string;
  onLowCommit: (value: number) => void;
  onHighCommit: (value: number) => void;
};

/** 트랙 위 하한·상한(또는 설정·편차) 반반 필드 — B안 */
export function SliderBoundFields({
  low,
  high,
  lowMin,
  lowMax,
  highMin,
  highMax,
  step,
  unit,
  lowCaption,
  highCaption,
  lowAria,
  highAria,
  disabled = false,
  size = "compact",
  highPrefix,
  domainText,
  domainClassName,
  onLowCommit,
  onHighCommit,
}: SliderBoundFieldsProps) {
  const mobile = useMobileLayout();
  const showDomain = Boolean(domainText) && (size !== "compact" || mobile);
  return (
    <div className="mb-2">
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <SliderValueInput
          layout="field"
          caption={lowCaption}
          value={low}
          min={lowMin}
          max={lowMax}
          step={step}
          unit={unit}
          aria-label={lowAria}
          disabled={disabled}
          size={size}
          onCommit={onLowCommit}
        />
        <SliderValueInput
          layout="field"
          caption={highCaption}
          value={high}
          min={highMin}
          max={highMax}
          step={step}
          unit={unit}
          prefix={highPrefix}
          aria-label={highAria}
          disabled={disabled}
          size={size}
          onCommit={onHighCommit}
        />
      </div>
      {showDomain ? (
        <p
          className={cn(
            "mt-1 text-center tabular-nums text-muted-foreground",
            domainClassName ?? "text-[10px] leading-snug",
          )}
          aria-hidden
        >
          {domainText}
        </p>
      ) : null}
    </div>
  );
}
