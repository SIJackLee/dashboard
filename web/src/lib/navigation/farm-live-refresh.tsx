"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  fetchFarmScopedPanelDataAction,
  revalidateFarmLiveAction,
} from "@/app/(dashboard)/farm/actions";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import type { AlarmSettings } from "@/lib/data/alarms";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import {
  getFarmPanelCache,
  setFarmPanelCache,
} from "@/lib/farm/farm-panel-cache";
import type { FarmScopedPanelData } from "@/lib/farm/load-farm-scoped-panel-data";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";

export type FarmLiveSlice = {
  readings: BarnReading[];
  barnSnapshots: BarnMapSnapshot[];
  gridCols: number;
  gridRows: number;
  trendByPeriod?: Record<TrendPeriodId, TrendPeriodData> | null;
  controller?: ControllerGridData | null;
};

type FarmLiveRefreshContextValue = {
  farmKey: FarmKey | null;
  slice: FarmLiveSlice;
  revalidating: boolean;
  isStale: boolean;
  revalidateFarmLive: () => Promise<void>;
  patchAlarmSettings: (settings: AlarmSettings) => void;
  hydrateScopedPanel: (data: FarmScopedPanelData) => void;
};

const FarmLiveRefreshContext =
  createContext<FarmLiveRefreshContextValue | null>(null);

function sliceFromPanel(data: FarmScopedPanelData): FarmLiveSlice {
  return {
    readings: data.readings,
    barnSnapshots: data.barnSnapshots,
    gridCols: data.gridCols,
    gridRows: data.gridRows,
    trendByPeriod: data.trendByPeriod,
    controller: data.controller,
  };
}

function sliceFingerprint(slice: FarmLiveSlice): string {
  const alarm = slice.controller?.alarmSettings?.global;
  return [
    slice.readings.length,
    slice.readings[0]?.key ?? "",
    slice.readings[0]?.tempC ?? "",
    alarm?.tempLow ?? "",
    alarm?.tempHigh ?? "",
  ].join("|");
}

type ProviderProps = {
  farmKey: FarmKey | null;
  initial: FarmLiveSlice;
  children: React.ReactNode;
};

export function FarmLiveRefreshProvider({
  farmKey,
  initial,
  children,
}: ProviderProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [slice, setSlice] = useState<FarmLiveSlice>(initial);
  const [revalidating, setRevalidating] = useState(false);
  const [alarmPatch, setAlarmPatch] = useState<AlarmSettings | null>(null);
  const revalidateSeq = useRef(0);
  const sliceRef = useRef(slice);
  sliceRef.current = slice;

  const serverFingerprint = useMemo(() => sliceFingerprint(initial), [initial]);

  useEffect(() => {
    if (
      farmKey &&
      initial.readings.length === 0 &&
      sliceRef.current.readings.length > 0
    ) {
      return;
    }

    if (farmKey && initial.readings.length === 0) {
      const cached = getFarmPanelCache(farmKeyId(farmKey));
      if (cached) {
        setSlice(sliceFromPanel(cached));
        return;
      }
    }

    setSlice(initial);
    setAlarmPatch(null);
    if (farmKey && initial.readings.length > 0) {
      setFarmPanelCache(farmKeyId(farmKey), {
        farmKey,
        readings: initial.readings,
        barnSnapshots: initial.barnSnapshots,
        gridCols: initial.gridCols,
        gridRows: initial.gridRows,
        trendByPeriod:
          initial.trendByPeriod ??
          ({} as Record<TrendPeriodId, TrendPeriodData>),
        controller: initial.controller ?? {
          readings: initial.readings,
          thermoSettings: {},
          commands: [],
          canCommand: false,
        },
      });
    }
  }, [farmKey, serverFingerprint, initial]);

  useEffect(() => {
    if (!farmKey || initial.readings.length > 0) return;
    if (sliceRef.current.readings.length > 0) return;

    let cancelled = false;
    void fetchFarmScopedPanelDataAction(farmKey)
      .then((data) => {
        if (cancelled) return;
        setFarmPanelCache(farmKeyId(farmKey), data);
        setSlice(sliceFromPanel(data));
        setAlarmPatch(null);
      })
      .catch(() => {
        /* cold bootstrap — 실패 시 빈 slice 유지 */
      });
    return () => {
      cancelled = true;
    };
  }, [farmKey, initial.readings.length]);

  const patchAlarmSettings = useCallback((settings: AlarmSettings) => {
    setAlarmPatch(settings);
    setSlice((prev) =>
      prev.controller
        ? {
            ...prev,
            controller: { ...prev.controller, alarmSettings: settings },
          }
        : prev,
    );
  }, []);

  const hydrateScopedPanel = useCallback((data: FarmScopedPanelData) => {
    setFarmPanelCache(farmKeyId(data.farmKey), data);
    setSlice((prev) => {
      const prevHasThermo =
        Object.keys(prev.controller?.thermoSettings ?? {}).length > 0;
      if (
        prev.controller?.alarmSettings &&
        data.controller.alarmSettings &&
        prevHasThermo
      ) {
        return prev;
      }
      return sliceFromPanel(data);
    });
    setAlarmPatch(null);
  }, []);

  /** Admin hub — readings만 있는 slice에 thermo·alarm 패널 데이터 보강 */
  useEffect(() => {
    if (!farmKey || initial.readings.length === 0) return;
    if (Object.keys(sliceRef.current.controller?.thermoSettings ?? {}).length > 0) {
      return;
    }

    let cancelled = false;
    void fetchFarmScopedPanelDataAction(farmKey)
      .then((data) => {
        if (cancelled) return;
        setFarmPanelCache(farmKeyId(farmKey), data);
        setSlice(sliceFromPanel(data));
        setAlarmPatch(null);
      })
      .catch(() => {
        /* hub warm — 실패 시 readings-only slice 유지 */
      });
    return () => {
      cancelled = true;
    };
  }, [farmKey, initial.readings.length]);

  const revalidateFarmLive = useCallback(async () => {
    if (!farmKey) {
      startTransition(() => router.refresh());
      return;
    }
    const farmId = farmKeyId(farmKey);
    const seq = ++revalidateSeq.current;
    setRevalidating(true);
    try {
      await revalidateFarmLiveAction(farmKey);
      const fresh = await fetchFarmScopedPanelDataAction(farmKey);
      if (seq !== revalidateSeq.current) return;
      setFarmPanelCache(farmId, fresh);
      setSlice(sliceFromPanel(fresh));
      setAlarmPatch(null);
    } catch {
      if (seq !== revalidateSeq.current) return;
      startTransition(() => router.refresh());
    } finally {
      if (seq === revalidateSeq.current) setRevalidating(false);
    }
  }, [farmKey, router]);

  const mergedSlice = useMemo(() => {
    if (!alarmPatch || !slice.controller) return slice;
    return {
      ...slice,
      controller: { ...slice.controller, alarmSettings: alarmPatch },
    };
  }, [alarmPatch, slice]);

  const value = useMemo(
    (): FarmLiveRefreshContextValue => ({
      farmKey,
      slice: mergedSlice,
      revalidating,
      isStale: revalidating && slice.readings.length > 0,
      revalidateFarmLive,
      patchAlarmSettings,
      hydrateScopedPanel,
    }),
    [
      farmKey,
      mergedSlice,
      patchAlarmSettings,
      hydrateScopedPanel,
      revalidateFarmLive,
      revalidating,
      slice.readings.length,
    ],
  );

  return (
    <FarmLiveRefreshContext.Provider value={value}>
      {children}
    </FarmLiveRefreshContext.Provider>
  );
}

export function useFarmLiveRefresh(): FarmLiveRefreshContextValue {
  const ctx = useContext(FarmLiveRefreshContext);
  if (!ctx) {
    throw new Error(
      "useFarmLiveRefresh must be used within FarmLiveRefreshProvider",
    );
  }
  return ctx;
}

/** Provider 밖 — optional fallback (hub embed 등) */
export function useFarmLiveRefreshOptional(): FarmLiveRefreshContextValue | null {
  return useContext(FarmLiveRefreshContext);
}

/** FarmScopedPanel — 모듈 캐시 warm */
export function warmFarmPanelCache(
  farmId: string,
  data: FarmScopedPanelData,
): void {
  setFarmPanelCache(farmId, data);
}

export function readFarmPanelCache(
  farmId: string,
): FarmScopedPanelData | undefined {
  return getFarmPanelCache(farmId);
}
