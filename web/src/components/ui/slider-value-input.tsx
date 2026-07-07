"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";

export type SliderValueInputSize = "compact" | "dashboard";

const SIZE_CLASS: Record<SliderValueInputSize, string> = {
  compact:
    "h-7 w-[3.25rem] shrink-0 px-1 text-center text-xs tabular-nums md:h-8 md:w-16 md:text-sm",
  dashboard:
    "h-9 w-[4.5rem] shrink-0 px-2 text-center text-sm tabular-nums md:h-12 md:w-24 md:text-[1.75rem]",
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
  onCommit: (value: number) => void;
};

/** 슬라이더 축 숫자 입력 — 타이핑 중 draft만, PC Enter / blur 시 commit */
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
  onCommit,
}: SliderValueInputProps) {
  const mobile = useMobileLayout();
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      revert();
      e.currentTarget.blur();
      return;
    }
    if (!mobile && e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {prefix ? (
        <span
          className={cn(
            "tabular-nums text-muted-foreground",
            size === "compact" ? "text-xs" : "text-sm md:text-[1.75rem]"
          )}
          aria-hidden
        >
          {prefix}
        </span>
      ) : null}
      <Input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        disabled={disabled}
        value={draft}
        uiSize="default"
        aria-invalid={invalid || undefined}
        className={cn(SIZE_CLASS[size], invalid && "border-destructive")}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          commit();
        }}
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          setDraft(e.target.value.replace(/[^\d.-]/g, ""));
          setInvalid(false);
        }}
      />
      <span
        className={cn(
          "shrink-0 tabular-nums text-muted-foreground",
          size === "compact" ? "text-[10px] md:text-xs" : "text-sm md:text-[1.75rem]"
        )}
        aria-hidden
      >
        {unit}
      </span>
    </div>
  );
}
