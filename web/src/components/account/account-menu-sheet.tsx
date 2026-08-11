"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useHydrationSafeDashboardCompact } from "@/components/layout/dashboard-viewport-context";
import { ACCOUNT_MENU_SHEET_Z, accountMenuLayout } from "@/lib/ui/account-menu-layout";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

type SheetMotionState = "open" | "exit";

function resolvePortalRoot(compact: boolean): HTMLElement | null {
  if (typeof window === "undefined") return null;
  if (compact) {
    const frame = document.querySelector("[data-mobile-preview-frame]");
    if (frame instanceof HTMLElement) return frame;
  }
  return document.body;
}

function measureHeaderBottom(portalRoot: HTMLElement): number {
  const header = document.querySelector("[data-app-header]");
  if (!header) return 0;
  const headerRect = header.getBoundingClientRect();
  if (portalRoot !== document.body) {
    const rootRect = portalRoot.getBoundingClientRect();
    return Math.max(0, Math.round(headerRect.bottom - rootRect.top));
  }
  return Math.round(headerRect.bottom);
}

export function AccountMenuSheet({ open, onOpenChange, children }: Props) {
  const compact = useHydrationSafeDashboardCompact();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [motionState, setMotionState] = useState<SheetMotionState>("open");
  const [headerBottom, setHeaderBottom] = useState(0);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const exitFinishedRef = useRef(false);
  const inPreviewFrame =
    portalRoot != null && portalRoot !== document.body;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      exitFinishedRef.current = false;
      setVisible(true);
      setMotionState("open");
      return;
    }
    if (visible) {
      setMotionState("exit");
    }
  }, [open, visible]);

  const syncLayout = useCallback(() => {
    const root = resolvePortalRoot(compact);
    if (!root) return;
    setPortalRoot(root);
    setHeaderBottom(measureHeaderBottom(root));
  }, [compact]);

  useLayoutEffect(() => {
    if (!visible) return;
    syncLayout();
    const header = document.querySelector("[data-app-header]");
    const root = resolvePortalRoot(compact);
    if (!root) return;
    const ro = new ResizeObserver(syncLayout);
    if (header) ro.observe(header);
    if (root !== document.body) ro.observe(root);
    window.addEventListener("resize", syncLayout);
    window.addEventListener("scroll", syncLayout, true);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", syncLayout);
      window.removeEventListener("scroll", syncLayout, true);
    };
  }, [visible, compact, syncLayout]);

  useEffect(() => {
    if (!visible) return;

    const root = resolvePortalRoot(compact);
    if (!root) return;
    const scrollTarget = root === document.body ? document.body : root;
    const prevOverflow = scrollTarget.style.overflow;
    scrollTarget.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      scrollTarget.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, compact, onOpenChange]);

  useEffect(() => {
    if (motionState === "open" && visible && panelRef.current) {
      const closeBtn = panelRef.current.querySelector<HTMLElement>(
        "[data-account-menu-close]",
      );
      closeBtn?.focus({ preventScroll: true });
    }
  }, [motionState, visible]);

  const finishExit = useCallback(() => {
    if (exitFinishedRef.current) return;
    exitFinishedRef.current = true;
    setVisible(false);
    setMotionState("open");
  }, []);

  const handlePanelAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return;
      if (motionState !== "exit") return;
      const name = e.animationName;
      if (
        name === "account-menu-sheet-panel-out" ||
        name === "none" ||
        name === ""
      ) {
        finishExit();
      }
    },
    [finishExit, motionState],
  );

  const handleBackdropAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLButtonElement>) => {
      if (motionState !== "exit") return;
      if (e.animationName === "ui-motion-fade-out") {
        finishExit();
      }
    },
    [finishExit, motionState],
  );

  if (!mounted || !visible || !portalRoot) return null;

  return createPortal(
    <>
      <button
        type="button"
        className={cn(
          accountMenuLayout.sheetBackdrop,
          inPreviewFrame
            ? accountMenuLayout.sheetBackdropAbsolute
            : accountMenuLayout.sheetBackdropFixed,
        )}
        style={{ top: headerBottom, zIndex: ACCOUNT_MENU_SHEET_Z - 1 }}
        data-state={motionState}
        data-account-menu-sheet-backdrop
        aria-label="계정 메뉴 닫기"
        onClick={() => onOpenChange(false)}
        onAnimationEnd={handleBackdropAnimationEnd}
      />
      <div
        ref={panelRef}
        id="account-menu-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-menu-sheet-title"
        data-state={motionState}
        data-tour-id="account-menu-panel"
        data-account-menu-sheet-panel
        className={cn(
          accountMenuLayout.sheetPanel,
          inPreviewFrame
            ? accountMenuLayout.sheetPanelInFrame
            : accountMenuLayout.sheetPanelFixed,
        )}
        style={{
          top: headerBottom,
          zIndex: ACCOUNT_MENU_SHEET_Z,
          ["--account-menu-sheet-top" as string]: `${headerBottom}px`,
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onAnimationEnd={handlePanelAnimationEnd}
      >
        <div className={accountMenuLayout.sheetInner}>{children}</div>
      </div>
    </>,
    portalRoot,
  );
}
