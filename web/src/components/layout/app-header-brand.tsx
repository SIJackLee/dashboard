"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

const BRAND_TITLE = "IoT Board";

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
      ? ({ "--brand-title-w": `${titleWidth}px` } as CSSProperties)
      : undefined;

  return (
    <div
      className={cn(
        dashboardUi.headerBrand,
        "text-2xl font-semibold leading-tight"
      )}
    >
      <div
        className={cn(
          dashboardUi.headerBrandIcon,
          titleWidth != null && "sm:w-[var(--brand-title-w)]"
        )}
        style={logoStyle}
      >
        <Image
          src="/logo.jpg"
          alt={BRAND_TITLE}
          fill
          sizes="(max-width: 639px) 144px, 120px"
          className="object-contain p-0.5"
          priority
        />
      </div>
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
