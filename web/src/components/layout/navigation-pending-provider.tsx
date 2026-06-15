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
import { Loader2 } from "lucide-react";
import {
  NAV_MIN_DISPLAY_MS,
  shouldUseGlobalNav,
} from "@/lib/navigation/nav-utils";
import {
  resolveNavMessage,
  type NavMessageOptions,
} from "@/lib/navigation/nav-messages";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

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
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/55 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border border-emerald-200/80 bg-background/95 px-6 py-4 shadow-lg",
              dashboardUi.body
            )}
          >
            <span className="inline-flex items-center gap-2 font-medium text-emerald-900">
              <Loader2
                className={cn(dashboardUi.iconSm, "animate-spin")}
                aria-hidden
              />
              {pending.message}
            </span>
            {pending.sublabel ? (
              <span className={cn("text-muted-foreground", dashboardUi.tableMeta)}>
                {pending.sublabel}
              </span>
            ) : null}
          </div>
        </div>
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
