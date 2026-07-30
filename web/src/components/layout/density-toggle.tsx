"use client";

import { useEffect, useState } from "react";
import { Rows2, UnfoldVertical } from "lucide-react";
import {
  applyDensity,
  nextDensity,
  readDensityFromDom,
  type UiDensity,
} from "@/lib/ui/density";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export function DensityToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<UiDensity>("comfortable");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setMode(readDensityFromDom());
      setReady(true);
    });
  }, []);

  const compact = mode === "compact";
  const next = nextDensity(mode);

  return (
    <button
      type="button"
      className={cn(dashboardUi.topHeaderActionBtn, className)}
      data-tour-id="header-density"
      aria-label={compact ? "넓은 간격으로 전환" : "촘촘한 간격으로 전환"}
      title={compact ? "넓은 간격" : "촘촘한 간격"}
      suppressHydrationWarning
      data-density-ready={ready || undefined}
      onClick={() => {
        applyDensity(next);
        setMode(next);
      }}
    >
      {compact ? (
        <UnfoldVertical className="size-4 md:size-5" aria-hidden />
      ) : (
        <Rows2 className="size-4 md:size-5" aria-hidden />
      )}
    </button>
  );
}
