import assert from "node:assert/strict";
import { weatherCtrlRecEnabled } from "@/lib/weather-control/weather-ctrl-enabled";

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void,
): void {
  const keys = Object.keys(patch);
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) {
    prev[k] = process.env[k];
    const v = patch[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const k of keys) {
      const v = prev[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

withEnv(
  {
    WEATHER_CTRL_REC_V1: "false",
    VERCEL_ENV: undefined,
    NEXT_PUBLIC_VERCEL_ENV: undefined,
    NODE_ENV: "production",
  },
  () => assert.equal(weatherCtrlRecEnabled(), false),
);

withEnv(
  {
    WEATHER_CTRL_REC_V1: "true",
    VERCEL_ENV: "production",
    NODE_ENV: "production",
  },
  () => assert.equal(weatherCtrlRecEnabled(), true),
);

withEnv(
  {
    WEATHER_CTRL_REC_V1: undefined,
    VERCEL_ENV: "preview",
    NODE_ENV: "production",
  },
  () => assert.equal(weatherCtrlRecEnabled(), true),
);

withEnv(
  {
    WEATHER_CTRL_REC_V1: undefined,
    VERCEL_ENV: "production",
    NODE_ENV: "production",
  },
  () => assert.equal(weatherCtrlRecEnabled(), false),
);

withEnv(
  {
    WEATHER_CTRL_REC_V1: undefined,
    VERCEL_ENV: undefined,
    NODE_ENV: "development",
  },
  () => assert.equal(weatherCtrlRecEnabled(), true),
);

console.log("weather-ctrl-enabled.test.ts ok");
