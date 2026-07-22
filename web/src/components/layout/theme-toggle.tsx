"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "dashboard-theme";

type ThemeMode = "light" | "dark";

function readThemeFromDom(): ThemeMode {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
  localStorage.setItem(STORAGE_KEY, mode);
}

export function ThemeToggle({ className }: { className?: string }) {
  // SSR·hydration 첫 렌더는 항상 light (blocking script의 dark class와 무관).
  // DOM 동기화는 mount 후 — 아이콘/aria는 suppressHydrationWarning으로 허용.
  const [mode, setMode] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMode(readThemeFromDom());
    setReady(true);
  }, []);

  const nextMode = mode === "dark" ? "light" : "dark";
  const labelDark = mode === "dark";

  return (
    <button
      type="button"
      className={cn(dashboardUi.topHeaderActionBtn, className)}
      data-tour-id="header-theme"
      aria-label={labelDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={labelDark ? "라이트 모드" : "다크 모드"}
      suppressHydrationWarning
      data-theme-ready={ready || undefined}
      onClick={() => {
        applyTheme(nextMode);
        setMode(nextMode);
      }}
    >
      {labelDark ? (
        <Sun className="size-4 md:size-5" aria-hidden />
      ) : (
        <Moon className="size-4 md:size-5" aria-hidden />
      )}
    </button>
  );
}
