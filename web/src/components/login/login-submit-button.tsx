"use client";

import { useFormStatus } from "react-dom";
import { BusyButtonLabel } from "@/components/common/busy-button-label";
import { cn } from "@/lib/utils";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700",
        "disabled:cursor-wait disabled:opacity-90"
      )}
    >
      <BusyButtonLabel
        busy={pending}
        idleLabel="로그인"
        busyLabel="로그인 중…"
      />
    </button>
  );
}
