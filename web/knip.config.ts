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
    "src/lib/farm/build-farm-unified-trend-raw.ts",
    // 모델 탭 편집기 (Production은 관리자만, docs/BARN_PLAN.md)
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
