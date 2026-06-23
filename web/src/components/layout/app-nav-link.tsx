"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, type ComponentProps, type MouseEvent } from "react";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { hrefToString, shouldUseGlobalNav } from "@/lib/navigation/nav-utils";
import type { NavMessageOptions } from "@/lib/navigation/nav-messages";
import { cn } from "@/lib/utils";

type AppNavLinkProps = ComponentProps<typeof Link> & NavMessageOptions;

export function AppNavLink({
  href,
  onClick,
  message,
  sublabel,
  className,
  ...rest
}: AppNavLinkProps) {
  const pathname = usePathname();
  const { navigate, isPending } = useAppNavigate();
  const hrefStr = hrefToString(href as Parameters<typeof hrefToString>[0]);
  const useGlobal = shouldUseGlobalNav(hrefStr, pathname);

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      if (isPending) {
        e.preventDefault();
        return;
      }
      if (!useGlobal) return;
      e.preventDefault();
      navigate(hrefStr, { message, sublabel });
    },
    [onClick, useGlobal, isPending, navigate, hrefStr, message, sublabel]
  );

  return (
    <Link
      href={href}
      className={cn(
        isPending && useGlobal && "pointer-events-none opacity-70",
        className
      )}
      onClick={handleClick}
      aria-busy={isPending && useGlobal ? true : undefined}
      {...rest}
    />
  );
}
