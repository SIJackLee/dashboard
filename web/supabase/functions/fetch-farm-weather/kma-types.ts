export type KmaGrid = { nx: number; ny: number };

export type KmaBaseSlot = {
  baseDate: string;
  baseTime: string;
};

export type KmaForecastPoint = {
  at: string;
  tempC: number | null;
  humidityPct: number | null;
};

export type KmaReading = {
  tempC: number | null;
  humidityPct: number | null;
  windMs: number | null;
  precipMm: number | null;
  forecastPoints: KmaForecastPoint[];
  ncstBase: KmaBaseSlot;
  fcstBase: KmaBaseSlot;
  resultCode: string;
  resultMsg: string;
  fetchOk: boolean;
  rawNcst: unknown;
  rawFcst: unknown;
};

export type KmaFetchResult =
  | { ok: true; reading: KmaReading }
  | { ok: false; error: string; reading: Partial<KmaReading> & { fetchOk: false } };
