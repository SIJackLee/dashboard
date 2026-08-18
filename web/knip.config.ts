import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/app/**/*.{ts,tsx}", "scripts/**/*.{mjs,ts}"],
  project: ["src/**/*.{ts,tsx}"],
  ignore: [
    "src/components/ui/**",
    "src/components/farm/farm-aria-view.tsx",
    "src/components/farm/delin-pig-env-panel.tsx",
    "src/components/farm/voice-report-fab.tsx",
    "src/components/farm/aria-answer-stage.tsx",
    "src/components/farm/aria-stage-layout.tsx",
    "src/components/farm/aria-orb.tsx",
    "src/components/farm/aria-metrics-slides.tsx",
    "src/components/farm/delin-weather-nudge-bubble.tsx",
  ],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: ["shadcn", "tw-animate-css", "tailwindcss"],
};

export default config;
