import type { KnipConfig } from "knip";

const config: KnipConfig = {
  entry: ["src/app/**/*.{ts,tsx}", "src/proxy.ts", "scripts/**/*.{mjs,ts}"],
  project: ["src/**/*.{ts,tsx}"],
  ignore: ["src/components/ui/**"],
  ignoreExportsUsedInFile: true,
  ignoreDependencies: ["shadcn", "tw-animate-css"],
};

export default config;
