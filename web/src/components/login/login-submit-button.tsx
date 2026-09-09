"use client";

import { useFormStatus } from "react-dom";
import { BusyButtonLabel } from "@/components/common/busy-button-label";
import { dashboardAffordance } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium",
        dashboardAffordance.action,
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
