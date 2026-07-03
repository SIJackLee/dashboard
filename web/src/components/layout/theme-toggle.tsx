"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "dashboard-theme";

type ThemeMode = "light" | "dark";

function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
  localStorage.setItem(STORAGE_KEY, mode);
}

export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  const nextMode = mode === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:size-11",
        className,
      )}
      aria-label={mode === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={mode === "dark" ? "라이트 모드" : "다크 모드"}
      onClick={() => {
        applyTheme(nextMode);
        setMode(nextMode);
      }}
    >
      {mode === "dark" ? (
        <Sun className="size-4 md:size-5" aria-hidden />
      ) : (
        <Moon className="size-4 md:size-5" aria-hidden />
      )}
    </button>
  );
}
