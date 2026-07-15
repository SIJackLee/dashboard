import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/app/**/*.{ts,tsx}", "scripts/**/*.{mjs,ts}"],
  project: ["src/**/*.{ts,tsx}"],
  ignore: ["src/components/ui/**"],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: ["shadcn", "tw-animate-css", "tailwindcss"],
};

export default config;
