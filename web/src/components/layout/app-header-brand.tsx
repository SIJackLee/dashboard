"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import {
  buildFarmMonitoringHomeParams,
  buildFarmMonitoringHomePath,
  currentFarmSearchParams,
  isFarmMonitoringSoftHome,
  replaceFarmUrlShallow,
  requestFarmHubViewResync,
} from "@/lib/farm/farm-view-url";
import { cn } from "@/lib/utils";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

const BRAND_TITLE = "IoT Board";
const LOGO_SCALE = 1.3;

export function AppHeaderBrand() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { navigate } = useAppNavigate();
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

  /** SSR·Link — Next searchParams. 클릭 시 window shallow URL 재계산 */
  const monitoringHomeHref = useMemo(
    () =>
      buildFarmMonitoringHomePath(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const goMonitoringHome = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      const live = currentFarmSearchParams();
      const homeParams = buildFarmMonitoringHomeParams(live);
      const href = buildFarmMonitoringHomePath(live);

      if (pathname === "/farm" && isFarmMonitoringSoftHome(live)) {
        e.preventDefault();
        return;
      }

      if (pathname === "/farm") {
        e.preventDefault();
        replaceFarmUrlShallow(homeParams);
        requestFarmHubViewResync();
        return;
      }

      // 다른 경로 → soft home (농장·기간 유지)
      e.preventDefault();
      navigate(href, { message: "모니터링으로 이동 중…" });
    },
    [pathname, navigate],
  );

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
        href={monitoringHomeHref}
        message="모니터링으로 이동 중…"
        aria-label="모니터링 홈"
        onClick={goMonitoringHome}
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
