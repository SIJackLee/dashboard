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
  fetchFarmScopedLiveDataAction,
  fetchFarmScopedPanelDataAction,
  revalidateFarmLiveAction,
} from "@/app/(dashboard)/farm/actions";
import type { ControllerGridData } from "@/lib/farm/controller-grid-data";
import type { AlarmSettings } from "@/lib/data/alarms";
import type { ThermoCommand } from "@/lib/data/commands";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import {
  buildThermoSettingsFromReadings,
  mergeThermoSettingsMaps,
  settingsFromCommand,
  thermoSettingsKey,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import {
  farmPanelCacheFromSlice,
  hasThermoSettings,
  shouldSkipScopedPanelHydrate,
} from "@/lib/farm/farm-scoped-panel-utils";
import {
  getFarmPanelCache,
  setFarmPanelCache,
} from "@/lib/farm/farm-panel-cache";
import type {
  FarmScopedLiveData,
  FarmScopedPanelData,
} from "@/lib/farm/load-farm-scoped-panel-data";
import type { BarnMapSnapshot, BarnReading } from "@/lib/data/iot";
import type { TrendPeriodData, TrendPeriodId } from "@/lib/data/farm-trend-types";
import { useFarmTourActive } from "@/lib/onboarding/use-farm-tour-active";

export type FarmLiveRevalidateMode = "live" | "full";

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
  /** admin defer 등 — farmKey는 있으나 readings 로딩 중 (빈 화면 대신 스켈레톤) */
  isBootstrapping: boolean;
  /** 기본 `live` — soft refresh/ACK. `full`은 bootstrap·강제 전체 갱신 */
  revalidateFarmLive: (opts?: {
    mode?: FarmLiveRevalidateMode;
  }) => Promise<void>;
  patchAlarmSettings: (settings: AlarmSettings) => void;
  /** 적용 직후 thermoSettings·commands에 명령값 즉시 반영 (낙관적) */
  patchThermoFromCommand: (cmd: ThermoCommand) => void;
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

type ApplyPanelArgs = {
  farmId: string;
  data: FarmScopedPanelData;
  setSlice: React.Dispatch<React.SetStateAction<FarmLiveSlice>>;
  setAlarmPatch: React.Dispatch<React.SetStateAction<AlarmSettings | null>>;
  setThermoPatch: React.Dispatch<
    React.SetStateAction<Record<string, ControllerThermoSettings>>
  >;
};

function applyFreshPanel({
  farmId,
  data,
  setSlice,
  setAlarmPatch,
  setThermoPatch,
}: ApplyPanelArgs): void {
  setFarmPanelCache(farmId, data);
  setSlice(sliceFromPanel(data));
  setAlarmPatch(null);
  setThermoPatch({});
}

type ApplyLiveArgs = {
  farmKey: FarmKey;
  data: FarmScopedLiveData;
  setSlice: React.Dispatch<React.SetStateAction<FarmLiveSlice>>;
};

/** LIVE만 패치 — trend·alarm·command history·낙관적 patch 유지 */
function applyLivePatch({ farmKey, data, setSlice }: ApplyLiveArgs): void {
  setSlice((prev) => {
    const readingThermo = buildThermoSettingsFromReadings(data.readings);
    const nextController = prev.controller
      ? {
          ...prev.controller,
          readings: data.readings,
          thermoSettings: mergeThermoSettingsMaps(
            prev.controller.thermoSettings,
            readingThermo,
          ),
        }
      : {
          readings: data.readings,
          thermoSettings: readingThermo,
          commands: [],
          canCommand: false,
        };
    const next: FarmLiveSlice = {
      ...prev,
      readings: data.readings,
      barnSnapshots: data.barnSnapshots,
      gridCols: data.gridCols,
      gridRows: data.gridRows,
      controller: nextController,
    };
    setFarmPanelCache(farmKeyId(farmKey), farmPanelCacheFromSlice(farmKey, next));
    return next;
  });
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
  const tourActive = useFarmTourActive();
  const [, startTransition] = useTransition();
  const [slice, setSlice] = useState<FarmLiveSlice>(() => {
    if (farmKey && initial.readings.length === 0) {
      const cached = getFarmPanelCache(farmKeyId(farmKey));
      if (cached) return sliceFromPanel(cached);
    }
    return initial;
  });
  const [revalidating, setRevalidating] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(() => {
    if (!farmKey || initial.readings.length > 0) return false;
    return !getFarmPanelCache(farmKeyId(farmKey));
  });
  const [alarmPatch, setAlarmPatch] = useState<AlarmSettings | null>(null);
  const [thermoPatch, setThermoPatch] = useState<
    Record<string, ControllerThermoSettings>
  >({});
  const revalidateSeq = useRef(0);
  const sliceRef = useRef(slice);
  useEffect(() => {
    sliceRef.current = slice;
  });

  const serverFingerprint = useMemo(() => sliceFingerprint(initial), [initial]);
  const farmId = farmKey ? farmKeyId(farmKey) : null;

  // Prop sync during render — initial/serverFingerprint 변경 시 slice 정렬
  const [prevSyncKey, setPrevSyncKey] = useState(
    () => `${farmId ?? ""}|${serverFingerprint}`,
  );
  const syncKey = `${farmId ?? ""}|${serverFingerprint}`;
  if (syncKey !== prevSyncKey) {
    setPrevSyncKey(syncKey);
    if (
      farmKey &&
      initial.readings.length === 0 &&
      slice.readings.length > 0
    ) {
      // keep client-hydrated slice while server still empty
      setIsBootstrapping(false);
    } else if (farmKey && initial.readings.length === 0) {
      const cached = getFarmPanelCache(farmKeyId(farmKey));
      if (cached) {
        setSlice(sliceFromPanel(cached));
        setIsBootstrapping(false);
      } else {
        setSlice(initial);
        setAlarmPatch(null);
        setThermoPatch({});
        setIsBootstrapping(true);
      }
    } else {
      setSlice(initial);
      setAlarmPatch(null);
      setThermoPatch({});
      if (farmKey && initial.readings.length > 0) {
        setIsBootstrapping(false);
      }
    }
  } else if (isBootstrapping && slice.readings.length > 0) {
    setIsBootstrapping(false);
  } else if (
    isBootstrapping &&
    (!farmKey || initial.readings.length > 0)
  ) {
    setIsBootstrapping(false);
  }

  // Cache write only — no setState (side effect of successful server payload)
  useEffect(() => {
    if (farmKey && initial.readings.length > 0) {
      setFarmPanelCache(
        farmKeyId(farmKey),
        farmPanelCacheFromSlice(farmKey, initial),
      );
    }
  }, [farmKey, serverFingerprint, initial]);

  const fetchAndApplyPanel = useCallback((key: FarmKey) => {
    const farmId = farmKeyId(key);
    let cancelled = false;
    void fetchFarmScopedPanelDataAction(key)
      .then((data) => {
        if (cancelled) return;
        applyFreshPanel({
          farmId,
          data,
          setSlice,
          setAlarmPatch,
          setThermoPatch,
        });
        setIsBootstrapping(false);
      })
      .catch(() => {
        /* cold bootstrap / hub warm — 실패 시 기존 slice 유지 */
        if (!cancelled) setIsBootstrapping(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Admin defer — readings 없이 진입 시 cold bootstrap (async only) */
  useEffect(() => {
    if (!farmKey || initial.readings.length > 0) return;
    if (sliceRef.current.readings.length > 0) return;
    if (getFarmPanelCache(farmKeyId(farmKey))) return;
    return fetchAndApplyPanel(farmKey);
  }, [farmKey, fetchAndApplyPanel, initial.readings.length]);

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

  const patchThermoFromCommand = useCallback(
    (cmd: ThermoCommand) => {
      const key = thermoSettingsKey(
        cmd.farmKey,
        cmd.moduleUid,
        cmd.controllerKey,
        cmd.channel,
      );
      const settings = settingsFromCommand(cmd);
      setThermoPatch((prev) => ({ ...prev, [key]: settings }));
      setSlice((prev) => {
        if (!prev.controller) return prev;
        const thermoSettings = {
          ...prev.controller.thermoSettings,
          [key]: settings,
        };
        const commands = [
          cmd,
          ...prev.controller.commands.filter((c) => c.id !== cmd.id),
        ];
        const next: FarmLiveSlice = {
          ...prev,
          controller: { ...prev.controller, thermoSettings, commands },
        };
        if (farmKey) {
          setFarmPanelCache(
            farmKeyId(farmKey),
            farmPanelCacheFromSlice(farmKey, next),
          );
        }
        return next;
      });
    },
    [farmKey],
  );

  const hydrateScopedPanel = useCallback((data: FarmScopedPanelData) => {
    // skip 시 캐시도 갱신하지 않음 — UI·캐시 신선도 불일치 방지
    if (shouldSkipScopedPanelHydrate(sliceRef.current, data)) return;
    setFarmPanelCache(farmKeyId(data.farmKey), data);
    setSlice(sliceFromPanel(data));
    setAlarmPatch(null);
    setThermoPatch({});
    setIsBootstrapping(false);
  }, []);

  /** Admin hub — readings만 있는 slice에 thermo·alarm 패널 데이터 보강 */
  useEffect(() => {
    if (tourActive) return;
    if (!farmKey || initial.readings.length === 0) return;
    if (hasThermoSettings(sliceRef.current.controller?.thermoSettings)) {
      return;
    }
    return fetchAndApplyPanel(farmKey);
  }, [farmKey, fetchAndApplyPanel, initial.readings.length, tourActive]);

  const revalidateFarmLive = useCallback(
    async (opts?: { mode?: FarmLiveRevalidateMode }) => {
      if (!farmKey) {
        startTransition(() => router.refresh());
        return;
      }
      const mode = opts?.mode ?? "live";
      const farmId = farmKeyId(farmKey);
      const seq = ++revalidateSeq.current;
      setRevalidating(true);
      try {
        await revalidateFarmLiveAction(farmKey);
        if (mode === "full") {
          const fresh = await fetchFarmScopedPanelDataAction(farmKey);
          if (seq !== revalidateSeq.current) return;
          applyFreshPanel({
            farmId,
            data: fresh,
            setSlice,
            setAlarmPatch,
            setThermoPatch,
          });
          return;
        }
        const live = await fetchFarmScopedLiveDataAction(farmKey);
        if (seq !== revalidateSeq.current) return;
        applyLivePatch({ farmKey, data: live, setSlice });
      } catch {
        if (seq !== revalidateSeq.current) return;
        startTransition(() => router.refresh());
      } finally {
        if (seq === revalidateSeq.current) setRevalidating(false);
      }
    },
    [farmKey, router],
  );

  const mergedSlice = useMemo(() => {
    if (!slice.controller) return slice;
    const hasThermo = Object.keys(thermoPatch).length > 0;
    if (!alarmPatch && !hasThermo) return slice;
    return {
      ...slice,
      controller: {
        ...slice.controller,
        ...(alarmPatch ? { alarmSettings: alarmPatch } : {}),
        ...(hasThermo
          ? {
              thermoSettings: {
                ...slice.controller.thermoSettings,
                ...thermoPatch,
              },
            }
          : {}),
      },
    };
  }, [alarmPatch, thermoPatch, slice]);

  const value = useMemo(
    (): FarmLiveRefreshContextValue => ({
      farmKey,
      slice: mergedSlice,
      revalidating,
      isStale: revalidating && slice.readings.length > 0,
      isBootstrapping,
      revalidateFarmLive,
      patchAlarmSettings,
      patchThermoFromCommand,
      hydrateScopedPanel,
    }),
    [
      farmKey,
      mergedSlice,
      patchAlarmSettings,
      patchThermoFromCommand,
      hydrateScopedPanel,
      revalidateFarmLive,
      revalidating,
      isBootstrapping,
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

