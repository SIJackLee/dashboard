import type { KmaBaseSlot } from "./kma-types.ts";

export type KstParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const ULTRA_FCST_MINUTES = [230, 530, 830, 1130, 1430, 1730, 2030, 2330];

export function toKstParts(now: Date = new Date()): KstParts {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
  };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatBaseDate(p: KstParts): string {
  return `${p.year}${pad2(p.month)}${pad2(p.day)}`;
}

function addDays(p: KstParts, delta: number): KstParts {
  const utc = Date.UTC(p.year, p.month - 1, p.day + delta, p.hour, p.minute);
  const d = new Date(utc);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
  };
}

export function resolveUltraNcstBase(now: Date = new Date()): KmaBaseSlot {
  const kst = toKstParts(now);
  let hour = kst.hour;
  let dateParts = kst;

  if (kst.minute < 40) {
    if (hour === 0) {
      dateParts = addDays(kst, -1);
      hour = 23;
    } else {
      hour -= 1;
    }
  }

  return {
    baseDate: formatBaseDate({ ...dateParts, hour, minute: kst.minute }),
    baseTime: `${pad2(hour)}00`,
  };
}

export function resolveUltraFcstBase(now: Date = new Date()): KmaBaseSlot {
  const kst = toKstParts(now);
  const clock = kst.hour * 100 + kst.minute;
  let slot = ULTRA_FCST_MINUTES[0];
  for (const candidate of ULTRA_FCST_MINUTES) {
    if (clock >= candidate) slot = candidate;
  }

  let dateParts = kst;
  if (clock < ULTRA_FCST_MINUTES[0]) {
    dateParts = addDays(kst, -1);
    slot = ULTRA_FCST_MINUTES[ULTRA_FCST_MINUTES.length - 1];
  }

  const hour = Math.floor(slot / 100);
  const minute = slot % 100;
  return {
    baseDate: formatBaseDate({ ...dateParts, hour, minute }),
    baseTime: `${pad2(hour)}${pad2(minute)}`,
  };
}
