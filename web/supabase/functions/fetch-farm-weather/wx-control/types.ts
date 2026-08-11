export type FarmKey = { lsindRegistNo: string; itemCode: string };

export type KmaForecastPoint = {
  at: string;
  tempC: number | null;
  humidityPct: number | null;
};

export type WeatherRuleId = "wx_humid_vent" | "wx_rise_vent" | "wx_drop_heat";

export type ThermoValues = {
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
};

export type SettingsSource = "live" | "applied" | "sent" | "pending";

export type ControllerCandidate = {
  farmKey: FarmKey;
  moduleUid: number;
  controllerKey: string;
  stallTyCode: string;
  stallNo: string;
  eqpmnNo: string;
  label: string;
  tempC: number | null;
  humidityPct: number | null;
  status: "normal" | "caution" | "offline";
  current: ThermoValues;
  settingsSource: SettingsSource;
  liveReceivedAt: string;
};

export type WeatherSnapshotInput = {
  tempC: number;
  humidityPct: number | null;
  forecastPoints: KmaForecastPoint[];
  observedAt: string;
};

export type WeatherRuleContext = {
  externalTempC: number;
  externalHumidityPct: number | null;
  internalTempC: number | null;
  internalHumidityPct: number | null;
  forecastMax3h: number | null;
  forecastMin3h: number | null;
  current: ThermoValues;
};

export type WeatherRuleDraft = {
  ruleId: WeatherRuleId;
  reasonKo: string;
  reasonFacts: Record<string, number>;
  proposed: ThermoValues;
};

export type WeatherRecommendationDraft = WeatherRuleDraft & {
  controller: ControllerCandidate;
  weatherObservedAt: string;
  externalTempC: number;
  externalHumidityPct: number | null;
  expiresAt: string;
};

export const THERMO_CAPS = {
  setpointMin: 18,
  setpointMax: 32,
  ventMin: 20,
  ventMax: 90,
} as const;

export const RULE_PRIORITY: WeatherRuleId[] = [
  "wx_humid_vent",
  "wx_rise_vent",
  "wx_drop_heat",
];
