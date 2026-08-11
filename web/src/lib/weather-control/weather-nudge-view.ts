/** Client-safe pending weather nudge payload (SSR → bubble). */
export type WeatherNudgeView = {
  id: string;
  ruleId: string;
  controllerLabel: string;
  controllerDisplayName: string;
  current: {
    setpointTemp: number;
    minVentPct: number;
    maxVentPct: number;
  };
  proposed: {
    setpointTemp: number;
    minVentPct: number;
    maxVentPct: number;
  };
  reasonKo: string;
  reasonFacts: Record<string, number>;
  expiresAt: string;
  stale: boolean;
};

export type UnpackedWeatherNudge = {
  headline: string;
  contextLine: string | null;
  currentLine: string;
  proposedLine: string;
  actionLine: string;
};
