import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: [
    "src/app/**/*.{ts,tsx}",
    "src/**/*.test.ts",
    "scripts/*.{mjs,ts}",
  ],
  project: ["src/**/*.{ts,tsx}"],
  ignore: [
    "src/components/ui/**",
    // 허브 미마운트 · 코드 보존 (docs/UI_ARIA_PRESENCE.md · aria-protocol.md)
    "src/components/farm/farm-aria-view.tsx",
    "src/components/farm/delin-pig-env-panel.tsx",
    "src/components/farm/voice-report-fab.tsx",
    "src/components/farm/aria-answer-stage.tsx",
    "src/components/farm/aria-stage-layout.tsx",
    "src/components/farm/aria-orb.tsx",
    "src/components/farm/aria-metrics-slides.tsx",
    "src/components/farm/delin-weather-nudge-bubble.tsx",
    "src/lib/ui/delin-reveal-sequence.ts",
    "src/lib/farm/build-farm-unified-trend-raw.ts",
    "src/lib/weather-control/use-weather-nudge-poll.ts",
    "src/lib/weather-control/run-evaluate-farm.ts",
    // 로컬·Preview 모델 탭 편집기 (Production 미마운트, docs/BARN_PLAN.md)
    "src/components/farm/farm-plan-corridor.tsx",
    "src/components/farm/farm-plan-dock-sheet.tsx",
    "src/components/farm/farm-plan-fill-editor.tsx",
    // 디자인 헬퍼 — 토큰 소비 예정, 현재 미import (docs/UI_MOTION.md · UI_DENSITY.md)
    "src/lib/ui/layout-breakpoints.ts",
    "src/lib/ui/motion-preset.ts",
    "src/lib/ui/use-container-compact.ts",
    "src/lib/ui/use-scroll-active-tab.ts",
  ],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: [
    "shadcn",
    "tw-animate-css",
    "tailwindcss",
    // webpack/브라우저 Buffer 폴리필 (src/lib/supabase/browser.ts)
    "buffer",
  ],
};

export default config;
