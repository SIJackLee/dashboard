"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

export function AppHeaderBrand() {
  return (
    <div className={cn(dashboardUi.headerBrand, "h-full shrink-0")}>
      <div
        className={cn(
          "relative aspect-square h-full max-h-11 min-h-10 shrink-0 overflow-hidden rounded-lg bg-muted/40"
        )}
      >
        <Image
          src="/logo.jpg"
          alt="IoT Board"
          fill
          sizes="(min-width: 768px) 44px, 40px"
          className="object-contain p-1"
          priority
        />
      </div>
      <p className={dashboardUi.headerBrandTitle} suppressHydrationWarning>
        IoT Board
      </p>
    </div>
  );
}
