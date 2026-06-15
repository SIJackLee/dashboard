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
import {
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

  const clearPending = useCallback(() => {
    pendingRef.current = false;
    targetPathRef.current = null;
    setPending(null);
  }, []);

  useEffect(() => {
    if (!pendingRef.current) return;

    const target = targetPathRef.current;
    if (target && !shouldUseGlobalNav(target, pathname)) {
      clearPending();
      return;
    }

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, NAV_MIN_DISPLAY_MS - elapsed);
    const timer = window.setTimeout(clearPending, remaining);
    return () => window.clearTimeout(timer);
  }, [pathname, searchParams, clearPending]);

  const navigate = useCallback(
    (href: string, options?: NavMessageOptions) => {
      if (pendingRef.current) return;
      if (!shouldUseGlobalNav(href, pathname)) {
        router.push(href);
        return;
      }

      pendingRef.current = true;
      startedAtRef.current = Date.now();
      targetPathRef.current = href;
      setPending(resolveNavMessage(href, options));
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
