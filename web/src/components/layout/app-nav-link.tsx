"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useSyncExternalStore,
  type ComponentProps,
  type MouseEvent,
} from "react";
import { useAppNavigate } from "@/components/layout/use-app-navigate";
import { hrefToString, shouldUseGlobalNav } from "@/lib/navigation/nav-utils";
import type { NavMessageOptions } from "@/lib/navigation/nav-messages";
import { cn } from "@/lib/utils";

type AppNavLinkProps = ComponentProps<typeof Link> & NavMessageOptions;

const emptySubscribe = () => () => {};

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
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  /** SSR·첫 페인트와 맞추기 — pending 시각은 클라이언트에서만 */
  const pendingVisual = mounted && isPending && useGlobal;

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
    [onClick, useGlobal, isPending, navigate, hrefStr, message, sublabel],
  );

  return (
    <Link
      href={href}
      className={cn(pendingVisual && "pointer-events-none opacity-70", className)}
      onClick={handleClick}
      aria-busy={pendingVisual ? true : undefined}
      {...rest}
    />
  );
}
