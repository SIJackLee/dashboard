"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NavigationLoadingOverlay } from "@/components/common/navigation-loading-overlay";
import { NAV_CONTENT_READY_EVENT, getLastNavContentReadyAt } from "@/lib/navigation/nav-content-ready";
import {
  NAV_MAX_WAIT_MS,
  NAV_MIN_DISPLAY_MS,
  shouldUseGlobalNav,
} from "@/lib/navigation/nav-utils";
import {
  resolveNavMessage,
  type NavMessageOptions,
} from "@/lib/navigation/nav-messages";

type PendingState = {
  message: string;
  sublabel?: string;
};

type NavigationPendingContextValue = {
  navigate: (href: string, options?: NavMessageOptions) => void;
  isPending: boolean;
};

const NavigationPendingContext =
  createContext<NavigationPendingContextValue | null>(null);

function NavigationPendingProviderInner({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState<PendingState | null>(null);
  const pendingRef = useRef(false);
  const startedAtRef = useRef(0);
  const targetPathRef = useRef<string | null>(null);
  const waitForReadyRef = useRef(false);
  const navigateStartedAtRef = useRef(0);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const isTargetPathReachedFor = useCallback((target: string | null, atPathname: string) => {
    if (!target) return false;
    return !shouldUseGlobalNav(target, atPathname);
  }, []);

  const isTargetPathReached = useCallback(
    (target: string | null) => isTargetPathReachedFor(target, pathnameRef.current),
    [isTargetPathReachedFor]
  );

  const clearPending = useCallback(() => {
    pendingRef.current = false;
    targetPathRef.current = null;
    waitForReadyRef.current = false;
    setPending(null);
  }, []);

  const scheduleClearAfterMinDisplay = useCallback(() => {
    const elapsed = Date.now() - startedAtRef.current;
    const minRemaining = Math.max(0, NAV_MIN_DISPLAY_MS - elapsed);
    window.setTimeout(clearPending, minRemaining);
  }, [clearPending]);

  useEffect(() => {
    if (!pending) return;

    const safetyTimer = window.setTimeout(clearPending, NAV_MAX_WAIT_MS);
    return () => window.clearTimeout(safetyTimer);
  }, [pending, clearPending]);

  useEffect(() => {
    if (!pending) return;

    const target = targetPathRef.current;
    if (!isTargetPathReached(target)) return;

    if (!waitForReadyRef.current) {
      scheduleClearAfterMinDisplay();
      return;
    }

    if (getLastNavContentReadyAt() >= navigateStartedAtRef.current) {
      scheduleClearAfterMinDisplay();
    }
  }, [
    pending,
    pathname,
    searchParams,
    isTargetPathReached,
    scheduleClearAfterMinDisplay,
  ]);

  useEffect(() => {
    if (!pending || !waitForReadyRef.current) return;

    const onContentReady = () => {
      const target = targetPathRef.current;
      const atPathname =
        typeof window !== "undefined" ? window.location.pathname : pathnameRef.current;
      if (!isTargetPathReachedFor(target, atPathname)) return;
      if (getLastNavContentReadyAt() < navigateStartedAtRef.current) return;
      scheduleClearAfterMinDisplay();
    };

    window.addEventListener(NAV_CONTENT_READY_EVENT, onContentReady);
    return () => window.removeEventListener(NAV_CONTENT_READY_EVENT, onContentReady);
  }, [pending, isTargetPathReachedFor, scheduleClearAfterMinDisplay]);

  const navigate = useCallback(
    (href: string, options?: NavMessageOptions) => {
      if (!shouldUseGlobalNav(href, pathname)) {
        router.push(href);
        return;
      }

      waitForReadyRef.current = options?.waitForContentReady ?? false;

      if (!pendingRef.current) {
        pendingRef.current = true;
        startedAtRef.current = Date.now();
        navigateStartedAtRef.current = startedAtRef.current;
        targetPathRef.current = href;
        setPending(resolveNavMessage(href, options));
      } else {
        targetPathRef.current = href;
        waitForReadyRef.current = options?.waitForContentReady ?? false;
        navigateStartedAtRef.current = Date.now();
      }

      router.push(href);
    },
    [pathname, router]
  );

  return (
    <NavigationPendingContext.Provider
      value={{ navigate, isPending: pending !== null }}
    >
      {children}
      {pending ? (
        <NavigationLoadingOverlay
          message={pending.message}
          sublabel={pending.sublabel}
        />
      ) : null}
    </NavigationPendingContext.Provider>
  );
}

export function NavigationPendingProvider({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <NavigationPendingProviderInner>{children}</NavigationPendingProviderInner>
    </Suspense>
  );
}

export function useNavigationPendingContext() {
  const ctx = useContext(NavigationPendingContext);
  if (!ctx) {
    throw new Error(
      "useAppNavigate must be used within NavigationPendingProvider"
    );
  }
  return ctx;
}
