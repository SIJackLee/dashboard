"use client";

const STORAGE_KEY = "dashboard-theme";

const listeners = new Set<() => void>();

let theme: "light" | "dark" = "light";

function readDomTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function notify(): void {
  listeners.forEach((l) => l());
}

export function getDashboardTheme(): "light" | "dark" {
  return theme;
}

export function subscribeDashboardTheme(listener: () => void): () => void {
  if (typeof document !== "undefined" && listeners.size === 0) {
    theme = readDomTheme();
  }
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 클라이언트 마운트 시 DOM·localStorage와 동기화 */
export function syncDashboardThemeFromDom(): void {
  const next = readDomTheme();
  if (next === theme) return;
  theme = next;
  notify();
}

export function toggleDashboardTheme(): "light" | "dark" {
  const next = theme === "dark" ? "light" : "dark";
  theme = next;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(STORAGE_KEY, next);
  }
  notify();
  return next;
}

export function setDashboardTheme(next: "light" | "dark"): void {
  theme = next;
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem(STORAGE_KEY, next);
  }
  notify();
}
