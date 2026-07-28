"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  busy: boolean;
  idleLabel: string;
  busyLabel: string;
  className?: string;
  iconClassName?: string;
  /** false면 문구만 (옆 아이콘 슬롯에 스피너가 있을 때). 기본 true. */
  showSpinner?: boolean;
};

/** 로그인 버튼과 동일한 busy 표현 — 스피너 + 문구 */
export function BusyButtonLabel({
  busy,
  idleLabel,
  busyLabel,
  className,
  iconClassName,
  showSpinner = true,
}: Props) {
  return (
    <span className={cn("inline-flex items-center justify-center gap-2", className)}>
      {busy && showSpinner ? (
        <Loader2
          className={cn("size-4 shrink-0 animate-spin", iconClassName)}
          aria-hidden
        />
      ) : null}
      {busy ? busyLabel : idleLabel}
    </span>
  );
}
