"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { MONITORING_BASE_PATH } from "@/lib/monitoring/monitoring-tabs";
import { cn } from "@/lib/utils";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

const BRAND_TITLE = "IoT Board";
const LOGO_SCALE = 1.3;

export function AppHeaderBrand() {
  const titleRef = useRef<HTMLParagraphElement>(null);
  const [titleWidth, setTitleWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.getBoundingClientRect().width;
      setTitleWidth(width > 0 ? Math.round(width) : null);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const logoStyle: CSSProperties | undefined =
    titleWidth != null
      ? ({ "--brand-title-w": `${Math.round(titleWidth * LOGO_SCALE)}px` } as CSSProperties)
      : undefined;

  return (
    <div
      className={cn(
        dashboardUi.headerBrand,
        "text-2xl font-semibold leading-tight"
      )}
    >
      <AppNavLink
        href={MONITORING_BASE_PATH}
        message="모니터링으로 이동 중…"
        aria-label="모니터링 홈"
        className={cn(
          dashboardUi.headerBrandIcon,
          titleWidth != null && "sm:w-[var(--brand-title-w)]",
          "transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        style={logoStyle}
      >
        <Image
          src="/logo.png"
          alt=""
          fill
          sizes="(max-width: 639px) 187px, 156px"
          className="object-contain p-0.5"
          priority
        />
      </AppNavLink>
      <p
        ref={titleRef}
        className={dashboardUi.headerBrandTitle}
        suppressHydrationWarning
      >
        {BRAND_TITLE}
      </p>
    </div>
  );
}
