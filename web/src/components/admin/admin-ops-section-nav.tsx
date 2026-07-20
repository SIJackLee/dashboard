"use client";

import { useCallback, useEffect, useState } from "react";
import { opsStatus, opsTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { id: "directory", label: "사용자" },
  { id: "scan", label: "스캔" },
  { id: "commands", label: "명령" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function readHash(): SectionId | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (hash === "directory" || hash === "commands" || hash === "scan") {
    return hash;
  }
  return null;
}

/** 해시 스크롤 + 현재 구역 미니 인디케이터. */
export function AdminOpsSectionNav() {
  const [active, setActive] = useState<SectionId | null>(() => readHash());

  const scrollTo = useCallback((id: SectionId) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.history.replaceState(null, "", `#${id}`);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }, []);

  useEffect(() => {
    const initial = readHash();
    if (initial) {
      document.getElementById(initial)?.scrollIntoView({ behavior: "smooth" });
    }

    const onHash = () => {
      const h = readHash();
      if (h) {
        document.getElementById(h)?.scrollIntoView({ behavior: "smooth" });
        setActive(h);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (n): n is HTMLElement => Boolean(n),
    );
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id as SectionId | undefined;
        if (top) setActive(top);
      },
      { root: null, rootMargin: "-20% 0px -55% 0px", threshold: [0.1, 0.4, 0.7] },
    );

    for (const n of nodes) observer.observe(n);
    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="운영 구역"
      className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-1 rounded-lg border border-border/60 bg-background/95 px-1.5 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/80"
    >
      <span className={cn("shrink-0 px-1", opsTypography.nav)}>구역</span>
      {SECTIONS.map((s) => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            type="button"
            aria-current={isActive ? "true" : undefined}
            onClick={() => scrollTo(s.id)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
              opsStatus.chipFocus,
              isActive ? opsStatus.selected : opsStatus.idle,
            )}
          >
            {s.label}
          </button>
        );
      })}
    </nav>
  );
}
