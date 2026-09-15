/** 채널 슬롯 설정 시계열 — decoded thermo (A 절대 ℃ · B/C는 A 오프셋). */

export type ChannelThermoVec = {
  setpoint: (number | null)[];
  deviation: (number | null)[];
  minVent: (number | null)[];
  maxVent: (number | null)[];
};

export type FanControlWindow = {
  loC: (number | null)[];
  hiC: (number | null)[];
  minVent: (number | null)[];
  maxVent: (number | null)[];
};

export function emptyChannelThermo(len: number): ChannelThermoVec {
  const col = () => new Array<number | null>(len).fill(null);
  return {
    setpoint: col(),
    deviation: col(),
    minVent: col(),
    maxVent: col(),
  };
}

export function sliceChannelThermo(
  vec: ChannelThermoVec | undefined,
  from: number,
  to: number,
): ChannelThermoVec | undefined {
  if (!vec) return undefined;
  return {
    setpoint: vec.setpoint.slice(from, to),
    deviation: vec.deviation.slice(from, to),
    minVent: vec.minVent.slice(from, to),
    maxVent: vec.maxVent.slice(from, to),
  };
}

function isFiniteNum(v: number | null | undefined): v is number {
  return v != null && Number.isFinite(v);
}

/** 값이 있는 슬롯을 다음 빈 칸까지 유지. 네 필드를 한 세트로 본다. */
export function holdForwardThermo(vec: ChannelThermoVec): ChannelThermoVec {
  const len = vec.setpoint.length;
  const out = emptyChannelThermo(len);
  type Last = {
    setpoint: number;
    deviation: number;
    minVent: number;
    maxVent: number;
  };
  let last: Last | null = null;
  for (let i = 0; i < len; i++) {
    if (isFiniteNum(vec.setpoint[i])) {
      const sp: number = vec.setpoint[i] as number;
      const nextDev: number = isFiniteNum(vec.deviation[i])
        ? (vec.deviation[i] as number)
        : last === null
          ? 0
          : last.deviation;
      const nextMin: number = isFiniteNum(vec.minVent[i])
        ? (vec.minVent[i] as number)
        : last === null
          ? 0
          : last.minVent;
      const nextMax: number = isFiniteNum(vec.maxVent[i])
        ? (vec.maxVent[i] as number)
        : last === null
          ? 0
          : last.maxVent;
      last = {
        setpoint: sp,
        deviation: nextDev,
        minVent: nextMin,
        maxVent: nextMax,
      };
    }
    if (last) {
      out.setpoint[i] = last.setpoint;
      out.deviation[i] = last.deviation;
      out.minVent[i] = last.minVent;
      out.maxVent[i] = last.maxVent;
    }
  }
  return out;
}

function lastThermoInRange(
  vec: ChannelThermoVec,
  from: number,
  to: number,
): {
  setpoint: number;
  deviation: number;
  minVent: number;
  maxVent: number;
} | null {
  for (let i = to - 1; i >= from; i--) {
    if (isFiniteNum(vec.setpoint[i])) {
      return {
        setpoint: vec.setpoint[i]!,
        deviation: isFiniteNum(vec.deviation[i]) ? vec.deviation[i]! : 0,
        minVent: isFiniteNum(vec.minVent[i]) ? vec.minVent[i]! : 0,
        maxVent: isFiniteNum(vec.maxVent[i]) ? vec.maxVent[i]! : 0,
      };
    }
  }
  return null;
}

export function downsampleThermoByIndices(
  vec: ChannelThermoVec | undefined,
  idx: number[],
): ChannelThermoVec | undefined {
  if (!vec) return undefined;
  const pick = (arr: (number | null)[]) => idx.map((i) => arr[i] ?? null);
  return {
    setpoint: pick(vec.setpoint),
    deviation: pick(vec.deviation),
    minVent: pick(vec.minVent),
    maxVent: pick(vec.maxVent),
  };
}

export function collapseThermoRange(
  vec: ChannelThermoVec | undefined,
  from: number,
  to: number,
): ChannelThermoVec | undefined {
  if (!vec) return undefined;
  const hit = lastThermoInRange(vec, from, to);
  const out = emptyChannelThermo(1);
  if (hit) {
    out.setpoint[0] = hit.setpoint;
    out.deviation[0] = hit.deviation;
    out.minVent[0] = hit.minVent;
    out.maxVent[0] = hit.maxVent;
  }
  return out;
}

/**
 * A 설정은 절대 ℃. B·C 설정온도는 A에 더하는 오프셋.
 * 최저 환기 = A(+오프셋), 최고 환기 = 그 점 + 편차.
 */
export function absFanWindows(
  a: ChannelThermoVec,
  b: ChannelThermoVec,
  c: ChannelThermoVec,
): { a: FanControlWindow; b: FanControlWindow; c: FanControlWindow } {
  const len = a.setpoint.length;
  const emptyWin = (): FanControlWindow => ({
    loC: new Array(len).fill(null),
    hiC: new Array(len).fill(null),
    minVent: new Array(len).fill(null),
    maxVent: new Array(len).fill(null),
  });
  const wa = emptyWin();
  const wb = emptyWin();
  const wc = emptyWin();
  for (let i = 0; i < len; i++) {
    const aSp = a.setpoint[i];
    const aDev = a.deviation[i];
    if (isFiniteNum(aSp) && isFiniteNum(aDev)) {
      wa.loC[i] = aSp;
      wa.hiC[i] = aSp + aDev;
      wa.minVent[i] = a.minVent[i] ?? null;
      wa.maxVent[i] = a.maxVent[i] ?? null;
    }
    if (isFiniteNum(aSp) && isFiniteNum(b.setpoint[i]) && isFiniteNum(b.deviation[i])) {
      const lo = aSp + b.setpoint[i]!;
      wb.loC[i] = lo;
      wb.hiC[i] = lo + b.deviation[i]!;
      wb.minVent[i] = b.minVent[i] ?? null;
      wb.maxVent[i] = b.maxVent[i] ?? null;
    }
    if (isFiniteNum(aSp) && isFiniteNum(c.setpoint[i]) && isFiniteNum(c.deviation[i])) {
      const lo = aSp + c.setpoint[i]!;
      wc.loC[i] = lo;
      wc.hiC[i] = lo + c.deviation[i]!;
      wc.minVent[i] = c.minVent[i] ?? null;
      wc.maxVent[i] = c.maxVent[i] ?? null;
    }
  }
  return { a: wa, b: wb, c: wc };
}

export function hasFiniteWindow(win: FanControlWindow): boolean {
  return win.loC.some((v, i) => isFiniteNum(v) && isFiniteNum(win.hiC[i]));
}

const TEMP_CHANGE_EPS = 0.05;
const VENT_CHANGE_EPS = 0.5;

export type ThermoChannelId = "A" | "B" | "C";

export type ThermoSnapshot = {
  loC: number | null;
  hiC: number | null;
  minVent: number | null;
  maxVent: number | null;
};

export type ThermoChannelChange = {
  channel: ThermoChannelId;
  prev: ThermoSnapshot;
  next: ThermoSnapshot;
  tempChanged: boolean;
  motorChanged: boolean;
};

export type ThermoChangeMark = {
  index: number;
  channels: ThermoChannelChange[];
};

function snapshotAt(win: FanControlWindow, i: number): ThermoSnapshot {
  return {
    loC: win.loC[i] ?? null,
    hiC: win.hiC[i] ?? null,
    minVent: win.minVent[i] ?? null,
    maxVent: win.maxVent[i] ?? null,
  };
}

function numChanged(
  a: number | null,
  b: number | null,
  eps: number,
): boolean {
  const af = isFiniteNum(a);
  const bf = isFiniteNum(b);
  if (!af && !bf) return false;
  if (!af || !bf) return false;
  return Math.abs(a - b) > eps;
}

function snapshotHasTemp(s: ThermoSnapshot): boolean {
  return isFiniteNum(s.loC) && isFiniteNum(s.hiC);
}

function snapshotHasMotor(s: ThermoSnapshot): boolean {
  return isFiniteNum(s.minVent) && isFiniteNum(s.maxVent);
}

/**
 * hold-forward된 창에서, 직전 칸과 값이 달라진 인덱스만.
 * 구간의 첫 유효값은 변경이 아니므로 넣지 않는다.
 * B·C는 A에 더한 오프셋이므로, A만 바뀐 경우 B·C는 변경으로 치지 않는다.
 */
export function thermoChangeMarks(windows: {
  a: FanControlWindow;
  b: FanControlWindow;
  c: FanControlWindow;
}): ThermoChangeMark[] {
  const len = windows.a.loC.length;
  const slots: { id: ThermoChannelId; win: FanControlWindow }[] = [
    { id: "A", win: windows.a },
    { id: "B", win: windows.b },
    { id: "C", win: windows.c },
  ];
  const out: ThermoChangeMark[] = [];
  for (let i = 1; i < len; i++) {
    const channels: ThermoChannelChange[] = [];
    for (const { id, win } of slots) {
      const prev = snapshotAt(win, i - 1);
      const next = snapshotAt(win, i);
      const aPrev = snapshotAt(windows.a, i - 1);
      const aNext = snapshotAt(windows.a, i);
      const prevTemp = snapshotHasTemp(prev);
      const nextTemp = snapshotHasTemp(next);
      const prevMotor = snapshotHasMotor(prev);
      const nextMotor = snapshotHasMotor(next);
      const tempChanged =
        prevTemp &&
        nextTemp &&
        (id === "A"
          ? numChanged(prev.loC, next.loC, TEMP_CHANGE_EPS) ||
            numChanged(prev.hiC, next.hiC, TEMP_CHANGE_EPS)
          : snapshotHasTemp(aPrev) &&
            snapshotHasTemp(aNext) &&
            (numChanged(
              (prev.loC as number) - (aPrev.loC as number),
              (next.loC as number) - (aNext.loC as number),
              TEMP_CHANGE_EPS,
            ) ||
              numChanged(
                (prev.hiC as number) - (prev.loC as number),
                (next.hiC as number) - (next.loC as number),
                TEMP_CHANGE_EPS,
              )));
      const motorChanged =
        prevMotor &&
        nextMotor &&
        (numChanged(prev.minVent, next.minVent, VENT_CHANGE_EPS) ||
          numChanged(prev.maxVent, next.maxVent, VENT_CHANGE_EPS));
      if (!tempChanged && !motorChanged) continue;
      channels.push({
        channel: id,
        prev,
        next,
        tempChanged,
        motorChanged,
      });
    }
    if (channels.length) out.push({ index: i, channels });
  }
  return out;
}
