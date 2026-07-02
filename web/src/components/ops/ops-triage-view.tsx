"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HierarchyAlarmTree,
  type ControllerSelectPayload,
} from "@/components/ops/hierarchy-alarm-tree";
import { SectionCard } from "@/components/common/section-card";
import type { ControllerReading } from "@/lib/data/iot";
import type { AlarmRow } from "@/lib/data/alarms";
import type { AlarmSettings } from "@/lib/data/alarms";
import { buildControllerHref } from "@/lib/auth/farm-access";
import type { ControllerGridData } from "@/components/farm/farm-map-controller-panel";
import type { FarmLocationRow } from "@/lib/data/farm-location";
import type { ThermoCommand } from "@/lib/data/commands";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import {
  appendFarmKeyParams,
  farmKeyId,
  parseFarmKeyFromQuery,
  type FarmKey,
} from "@/lib/data/farm-key";
import {
  filterReadingsByFarm,
  filterReadingsByFarmAndSp,
  filterReadingsByHierarchy,
  stallKeyFromReading,
  stallLabelFromKey,
  uniqueSpCodes,
  uniqueStallKeys,
  uniqueStallKeysForFarm,
} from "@/lib/data/reading-hierarchy";
import { formatStallTypeLabel, normalizeStallTyCode } from "@/lib/data/stall-type";
import { farmShortLabel, type FarmSummaryRow } from "@/lib/data/farm-summaries";
import { setMonitoringTabParam } from "@/lib/monitoring/monitoring-tabs";
import {
  buildHubTriageFarms,
  pickWorstControllerPayload,
} from "@/lib/monitoring/hub-triage-queue";
import {
  filterLayoutPrefsForFarm,
  hubPhaseFromSido,
  isGeoHubFarmGridUrl,
  shouldHubMapMini,
  shouldHubStackListUnderMap,
  type HubBarnLayoutPrefs,
  type HubViewPhase,
} from "@/lib/monitoring/hub-view-state";
import {
  buildSpNavQueue,
  buildSpTriageQueue,
  OpsMobileSpOverview,
  pickReadingForSp,
} from "@/components/ops/ops-mobile-sp-overview";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";
import { OpsMobileAlarmStrip } from "@/components/ops/ops-mobile-alarm-strip";
import { OpsMobileSplitHub } from "@/components/ops/ops-mobile-split-hub";
import {
  OpsMobileFarmGridOnly,
  OpsMobileSplitShell,
} from "@/components/ops/ops-mobile-split-shell";

const AdminFarmOverview = dynamic(
  () =>
    import("@/components/admin/admin-farm-overview").then(
      (m) => m.AdminFarmOverview
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[200px] items-center justify-center rounded-xl border bg-muted/20">
        <p className={cn("text-muted-foreground", dashboardUi.body)}>지도 로딩…</p>
      </div>
    ),
  }
);

const AdminControllerPlaceholderClient = dynamic(
  () =>
    import("@/components/admin/admin-controller-placeholder").then(
      (m) => m.AdminControllerPlaceholder
    ),
  { ssr: false }
);

const AdminHubFarmMapPanel = dynamic(
  () =>
    import("@/components/admin/admin-hub-farm-map-panel").then(
      (m) => m.AdminHubFarmMapPanel
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[8rem] animate-pulse rounded-xl border bg-muted/15" />
    ),
  }
);

type Option = { value: string; label: string };

export type OpsTriageViewProps = {
  readings: ControllerReading[];
  alarms: AlarmRow[];
  alarmSummary?: {
    total: number;
    critical: number;
    warning: number;
    offline: number;
  };
  initialLsind?: string;
  initialItem?: string;
  initialSp?: string;
  initialStall?: string;
  initialCtrl?: string;
  initialAlarm?: string;
  canCommand: boolean;
  commands?: ThermoCommand[];
  thermoSettings?: Record<string, ControllerThermoSettings>;
  isAdmin?: boolean;
  adminAllFarms?: boolean;
  farmSummaries?: FarmSummaryRow[];
  adminFarmOptions?: FarmKey[];
  adminActiveFarmKey?: FarmKey | null;
  alarmSettings?: AlarmSettings;
  settingsNotice?: { tone: "ok" | "error"; text: string } | null;
  /** Admin 전국 허브 — 지도|목록|패널 가로 3열 */
  geoHub?: {
    farmSummaries: FarmSummaryRow[];
    locations: FarmLocationRow[];
  };
  /** farmer형 4×4 — profiles.ui_config barnLayouts */
  barnLayoutPrefs?: HubBarnLayoutPrefs;
};

function filterBySido<T extends { farmKey: FarmKey }>(
  rows: T[],
  locations: FarmLocationRow[],
  activeSido: string | null,
  preserveFarmId?: string | null
): T[] {
  if (!activeSido) return rows;
  const allowed = new Set(
    locations
      .filter((l) => l.sido === activeSido)
      .map((l) => farmKeyId(l.farmKey))
  );
  const filtered = rows.filter((r) => allowed.has(farmKeyId(r.farmKey)));
  if (filtered.length > 0) return filtered;
  if (preserveFarmId) {
    const kept = rows.filter((r) => farmKeyId(r.farmKey) === preserveFarmId);
    if (kept.length > 0) return kept;
  }
  return rows;
}

function uniqueFarmOptions(readings: ControllerReading[]): Option[] {
  const seen = new Map<string, FarmKey>();
  for (const r of readings) {
    const id = farmKeyId(r.farmKey);
    if (!seen.has(id)) seen.set(id, r.farmKey);
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, fk]) => ({
      value: id,
      label: farmShortLabel(fk),
    }));
}

function spOptionsForFarm(readings: ControllerReading[], farmId: string): Option[] {
  return uniqueSpCodes(readings, farmId).map((code) => ({
    value: code,
    label: formatStallTypeLabel(code),
  }));
}

function stallOptionsForFarmSp(
  readings: ControllerReading[],
  farmId: string,
  spCode: string
): Option[] {
  const keys = spCode
    ? uniqueStallKeys(readings, farmId, spCode)
    : uniqueStallKeysForFarm(readings, farmId);
  return keys.map((key) => ({
    value: key,
    label: stallLabelFromKey(key),
  }));
}

function filterControllersForScope(
  readings: ControllerReading[],
  farmId: string,
  spCode: string,
  stallKey: string
): ControllerReading[] {
  if (!spCode) {
    return filterReadingsByFarm(readings, farmId);
  }
  if (!stallKey) {
    return filterReadingsByFarmAndSp(readings, farmId, spCode);
  }
  return filterReadingsByHierarchy(readings, farmId, spCode, stallKey);
}

function stallKeyFromControllerParam(ctrl: string | undefined): string | null {
  if (!ctrl) return null;
  try {
    const parts = decodeURIComponent(ctrl).split(":");
    if (parts.length === 3 && parts[1]?.trim()) {
      return parts[1]!.trim();
    }
  } catch {
    return null;
  }
  return null;
}

function pickInitialStall(
  readings: ControllerReading[],
  farmId: string,
  spCode: string,
  preferred?: string,
  ctrlParam?: string
): string {
  if (preferred === "") return "";
  const keys = spCode
    ? uniqueStallKeys(readings, farmId, spCode)
    : uniqueStallKeysForFarm(readings, farmId);
  if (preferred && keys.includes(preferred)) return preferred;
  const fromCtrl = stallKeyFromControllerParam(ctrlParam);
  if (fromCtrl && keys.includes(fromCtrl)) return fromCtrl;
  return keys[0] ?? "";
}

function pickInitialSp(
  options: Option[],
  preferred: string | undefined
): string {
  if (preferred === "") return "";
  if (preferred && options.some((o) => o.value === preferred)) return preferred;
  return options[0]?.value ?? "";
}

function pickInitial(options: Option[], preferred: string | undefined): string {
  if (preferred && options.some((o) => o.value === preferred)) return preferred;
  return options[0]?.value ?? "";
}

function pickCtrlKey(list: ControllerReading[], preferred?: string) {
  if (preferred) {
    const decoded = decodeURIComponent(preferred);
    const hit = list.find(
      (r) =>
        r.controllerKey === decoded ||
        r.eqpmnNo === preferred ||
        (r.idx != null && String(r.idx) === preferred)
    );
    if (hit) return hit.key;
  }
  return list[0]?.key ?? "";
}

export function OpsTriageView(props: OpsTriageViewProps) {
  const searchParams = useSearchParams();
  const scopeKey = `${searchParams.get("lsind") ?? ""}-${searchParams.get("item") ?? ""}`;
  return <OpsTriageViewBody key={scopeKey} {...props} />;
}

function OpsTriageViewBody({
  readings,
  alarms,
  initialLsind,
  initialItem,
  initialSp,
  initialStall,
  initialCtrl,
  initialAlarm,
  canCommand,
  commands = [],
  thermoSettings = {},
  isAdmin = false,
  adminAllFarms = false,
  farmSummaries = [],
  adminFarmOptions = [],
  adminActiveFarmKey = null,
  alarmSettings,
  settingsNotice = null,
  geoHub,
  barnLayoutPrefs,
}: OpsTriageViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMobileLayout();
  const [navSweepDirection, setNavSweepDirection] = useState<
    "left" | "right" | null
  >(null);
  const geoHubMode = Boolean(geoHub);
  const initialUrlFarmKey = parseFarmKeyFromQuery(initialLsind, initialItem);
  const initialUrlFarmId = initialUrlFarmKey
    ? farmKeyId(initialUrlFarmKey)
    : undefined;
  const initialGeoHubFarmGridUrl = isGeoHubFarmGridUrl(
    geoHubMode,
    initialUrlFarmId,
    initialCtrl,
    initialSp,
    initialStall
  );
  const [activeSido, setActiveSido] = useState<string | null>(null);
  const [hubPhase, setHubPhase] = useState<HubViewPhase>(() =>
    initialGeoHubFarmGridUrl ? "farm" : "overview"
  );
  const [hubFarmId, setHubFarmId] = useState<string | null>(() =>
    initialGeoHubFarmGridUrl ? (initialUrlFarmId ?? null) : null
  );
  const mapMini = shouldHubMapMini(hubPhase, !isMobile);
  const stackListUnderMap = shouldHubStackListUnderMap(mapMini, !isMobile);
  const hubLayoutPrefs = barnLayoutPrefs ?? { layouts: {}, aliases: {} };

  const handleSelectSido = useCallback((sido: string | null) => {
    setActiveSido(sido);
    setHubPhase(hubPhaseFromSido(sido));
    if (sido) {
      setHubFarmId(null);
    }
  }, []);

  const handleMapExpand = useCallback(() => {
    setActiveSido(null);
    setHubPhase("overview");
    setHubFarmId(null);
    setFarmId("");
    setSpCode("");
    setStallKey("");
    setControllerKey("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("lsind");
    params.delete("item");
    params.delete("sp");
    params.delete("stall");
    params.delete("ctrl");
    params.delete("alarm");
    params.set("tab", "ops");
    params.delete("hub");
    router.replace(`/farm?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const urlFarmKey = parseFarmKeyFromQuery(
    searchParams.get("lsind") ?? initialLsind,
    searchParams.get("item") ?? initialItem
  );
  const urlFarmId = urlFarmKey ? farmKeyId(urlFarmKey) : undefined;
  const urlSp = searchParams.get("sp") ?? initialSp;
  const urlStall = searchParams.get("stall") ?? initialStall;
  const urlCtrl = searchParams.get("ctrl") ?? initialCtrl;
  const urlAlarm = searchParams.get("alarm") ?? initialAlarm;
  const hubPickerMode = geoHubMode && !urlFarmId;
  const adminAllNoFarm = isAdmin && !urlFarmId && !geoHubMode;
  const geoHubFarmGridUrl = isGeoHubFarmGridUrl(
    geoHubMode,
    urlFarmId,
    urlCtrl,
    urlSp,
    urlStall
  );

  const farmOptions = useMemo(() => uniqueFarmOptions(readings), [readings]);

  const [farmId, setFarmId] = useState(() =>
    hubPickerMode || adminAllNoFarm ? "" : pickInitial(farmOptions, urlFarmId)
  );

  const [spCode, setSpCode] = useState(() => {
    if (hubPickerMode || adminAllNoFarm) return "";
    if (geoHubFarmGridUrl) return "";
    const f = pickInitial(farmOptions, urlFarmId);
    return pickInitialSp(spOptionsForFarm(readings, f), urlSp ?? undefined);
  });

  const [stallKey, setStallKey] = useState(() => {
    if (hubPickerMode || adminAllNoFarm) return "";
    if (geoHubFarmGridUrl) return "";
    const f = pickInitial(farmOptions, urlFarmId);
    const sp = pickInitial(spOptionsForFarm(readings, f), urlSp);
    return pickInitialStall(readings, f, sp, urlStall ?? undefined, urlCtrl);
  });

  const controllerList = useMemo(
    () => filterControllersForScope(readings, farmId, spCode, stallKey),
    [readings, farmId, spCode, stallKey]
  );

  const [controllerKey, setControllerKey] = useState(() => {
    if (hubPickerMode || adminAllNoFarm) return "";
    if (geoHubFarmGridUrl) return "";
    const f = pickInitial(farmOptions, urlFarmId);
    const sp = pickInitial(spOptionsForFarm(readings, f), urlSp);
    const stall = pickInitialStall(readings, f, sp, urlStall ?? undefined, urlCtrl);
    return pickCtrlKey(
      filterControllersForScope(readings, f, sp, stall),
      urlCtrl
    );
  });

  const selectedFarmKey = useMemo((): FarmKey | undefined => {
    const hit = readings.find((r) => farmKeyId(r.farmKey) === farmId);
    return hit?.farmKey;
  }, [readings, farmId]);

  const selected = controllerKey
    ? controllerList.find((r) => r.key === controllerKey)
    : geoHubMode && hubFarmId
      ? undefined
      : controllerList[0];

  const globalAlarms = useMemo(() => {
    const severityRank = (a: AlarmRow) => {
      if (a.severity === "critical") return 0;
      if (a.alarmType === "통신 두절") return 2;
      return 1;
    };
    return [...alarms].sort((a, b) => {
      const bySeverity = severityRank(a) - severityRank(b);
      if (bySeverity !== 0) return bySeverity;
      return b.occurredAt.localeCompare(a.occurredAt);
    });
  }, [alarms]);

  const hubFarmSummaries = useMemo(() => {
    if (!geoHub) return farmSummaries;
    return filterBySido(
      geoHub.farmSummaries,
      geoHub.locations,
      activeSido,
      hubFarmId ?? urlFarmId ?? null
    );
  }, [geoHub, farmSummaries, activeSido, hubFarmId, urlFarmId]);

  const hubReadings = useMemo(() => {
    if (!geoHub) return readings;
    return filterBySido(
      readings,
      geoHub.locations,
      activeSido,
      hubFarmId ?? urlFarmId ?? null
    );
  }, [geoHub, readings, activeSido, hubFarmId, urlFarmId]);

  const hubAlarms = useMemo(() => {
    if (!geoHub) return globalAlarms;
    return filterBySido(
      globalAlarms,
      geoHub.locations,
      activeSido,
      hubFarmId ?? urlFarmId ?? null
    );
  }, [geoHub, globalAlarms, activeSido, hubFarmId, urlFarmId]);

  const triageFarms = useMemo(
    () => buildHubTriageFarms(hubAlarms, hubReadings, hubFarmSummaries),
    [hubAlarms, hubReadings, hubFarmSummaries]
  );

  const triageIndex = useMemo(() => {
    if (!farmId) return -1;
    return triageFarms.findIndex((f) => f.farmId === farmId);
  }, [triageFarms, farmId]);

  const activeTriageFarm = useMemo(
    () => triageFarms.find((f) => f.farmId === farmId),
    [triageFarms, farmId]
  );

  const spTriageQueue = useMemo(
    () =>
      geoHubMode
        ? []
        : buildSpTriageQueue(readings, hubAlarms, farmId || undefined),
    [geoHubMode, hubAlarms, readings, farmId]
  );

  const spNavQueue = useMemo(
    () =>
      geoHubMode
        ? []
        : buildSpNavQueue(readings, hubAlarms, farmId || undefined),
    [geoHubMode, hubAlarms, readings, farmId]
  );

  const spNavIndex = useMemo(() => {
    if (!spCode || spNavQueue.length === 0) return -1;
    return spNavQueue.findIndex(
      (item) => normalizeStallTyCode(item.spCode) === normalizeStallTyCode(spCode)
    );
  }, [spNavQueue, spCode]);

  const autoTriageBooted = useRef(false);
  const autoFarmerBarnBooted = useRef(false);

  const farmScopeCount = useMemo(() => {
    const ids = new Set<string>();
    const scopeReadings = geoHub ? hubReadings : readings;
    const scopeSummaries = geoHub ? hubFarmSummaries : farmSummaries;
    for (const r of scopeReadings) ids.add(farmKeyId(r.farmKey));
    for (const s of scopeSummaries) ids.add(farmKeyId(s.farmKey));
    return ids.size;
  }, [readings, farmSummaries, geoHub, hubReadings, hubFarmSummaries]);

  const syncUrl = (
    fk: FarmKey | undefined,
    sp: string,
    stall: string,
    ctrl: ControllerReading | undefined,
    alarmId?: string | null
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (fk) {
      params.delete("lsind");
      params.delete("item");
      appendFarmKeyParams(params, fk);
    }
    if (sp) params.set("sp", sp);
    else params.delete("sp");
    if (stall) params.set("stall", stall);
    else params.delete("stall");
    if (ctrl) params.set("ctrl", ctrl.controllerKey);
    else params.delete("ctrl");
    if (alarmId) params.set("alarm", alarmId);
    else params.delete("alarm");
    if (geoHubMode) {
      params.set("tab", "ops");
      params.delete("hub");
    } else setMonitoringTabParam(params, "ops");
    router.replace(`/farm?${params.toString()}`, { scroll: false });
  };

  const navigateToController = (
    payload: ControllerSelectPayload,
    alarmId?: string | null
  ) => {
    const reading = readings.find((r) => r.key === payload.readingKey);
    if (!reading) return;

    setFarmId(farmKeyId(payload.farmKey));
    setSpCode(payload.spCode);
    setStallKey(payload.stallKey);
    setControllerKey(payload.readingKey);
    if (geoHubMode) {
      setHubFarmId(farmKeyId(payload.farmKey));
      setHubPhase("drill");
    }
    syncUrl(
      payload.farmKey,
      payload.spCode,
      payload.stallKey,
      reading,
      alarmId ?? null
    );
  };

  const navigateToHubFarm = useCallback(
    (targetFarmId: string) => {
      const farmKey =
        hubReadings.find((r) => farmKeyId(r.farmKey) === targetFarmId)?.farmKey ??
        hubFarmSummaries.find((s) => farmKeyId(s.farmKey) === targetFarmId)
          ?.farmKey;
      if (!farmKey) return;

      setHubFarmId(targetFarmId);
      setHubPhase("farm");
      setFarmId(targetFarmId);
      setSpCode("");
      setStallKey("");
      setControllerKey("");
      syncUrl(farmKey, "", "", undefined, null);
    },
    [hubReadings, hubFarmSummaries, searchParams, router, geoHubMode]
  );

  const handleHubFarmSelect = useCallback(
    (targetFarmId: string) => {
      if (!geoHubMode) return;
      navigateToHubFarm(targetFarmId);
    },
    [geoHubMode, navigateToHubFarm]
  );

  const navigateToAlarm = (alarm: AlarmRow) => {
    const targetFarmId = farmKeyId(alarm.farmKey);
    const sp = alarm.stallTyCode ? normalizeStallTyCode(alarm.stallTyCode) : "";
    const stall = alarm.stallNo?.trim() ?? "";
    const ctrl = readings.find(
      (r) =>
        farmKeyId(r.farmKey) === targetFarmId &&
        r.controllerKey === alarm.controllerKey
    );

    if (ctrl) {
      navigateToController(
        {
          farmKey: alarm.farmKey,
          spCode: sp,
          stallKey: stall || stallKeyFromReading(ctrl),
          readingKey: ctrl.key,
        },
        alarm.id
      );
      return;
    }

    setFarmId(targetFarmId);
    setSpCode(sp);
    setStallKey(stall);

    router.replace(
      buildControllerHref({
        farmKey: alarm.farmKey,
        sp: alarm.stallTyCode,
        stallNo: alarm.stallNo,
        controllerKey: alarm.controllerKey,
        ctrlIdx: alarm.idx,
        alarmId: alarm.id,
      }),
      { scroll: false }
    );
  };

  const goTriageFarmAt = (index: number) => {
    const farm = triageFarms[index];
    if (!farm) return;
    if (geoHubMode && isMobile && !controllerKey) {
      navigateToHubFarm(farm.farmId);
      return;
    }
    const payload = pickWorstControllerPayload(
      hubAlarms,
      hubReadings,
      farm.farmKey
    );
    if (payload) navigateToController(payload);
  };

  const goPrevTriageFarm = () => {
    if (triageFarms.length === 0) return;
    const idx =
      triageIndex <= 0 ? triageFarms.length - 1 : triageIndex - 1;
    goTriageFarmAt(idx);
  };

  const goNextTriageFarm = () => {
    if (triageFarms.length === 0) return;
    const idx =
      triageIndex < 0 ? 0 : (triageIndex + 1) % triageFarms.length;
    goTriageFarmAt(idx);
  };

  const handleMapFarmSelect = (targetFarmId: string) => {
    if (!geoHubMode || !isMobile) return;
    if (targetFarmId === hubFarmId) return;

    const newIdx = triageFarms.findIndex((f) => f.farmId === targetFarmId);
    const prevFarmId = hubFarmId || farmId;
    const oldIdx = prevFarmId
      ? triageFarms.findIndex((f) => f.farmId === prevFarmId)
      : triageIndex;
    if (newIdx >= 0 && oldIdx >= 0 && newIdx !== oldIdx) {
      setNavSweepDirection(newIdx > oldIdx ? "left" : "right");
    } else if (newIdx >= 0) {
      setNavSweepDirection(newIdx > Math.max(oldIdx, 0) ? "left" : "right");
    } else {
      setNavSweepDirection("left");
    }

    navigateToHubFarm(targetFarmId);
    window.setTimeout(() => setNavSweepDirection(null), 280);
  };

  const splitHubFarmLabel = (() => {
    if (hubFarmId) {
      const fromReading = hubReadings.find(
        (r) => farmKeyId(r.farmKey) === hubFarmId
      )?.farmKey;
      const fromSummary = hubFarmSummaries.find(
        (s) => farmKeyId(s.farmKey) === hubFarmId
      )?.farmKey;
      const fk = fromReading ?? fromSummary;
      if (fk) return farmShortLabel(fk);
    }
    if (urlFarmKey) return farmShortLabel(urlFarmKey);
    return (
      activeTriageFarm?.label ??
      (selectedFarmKey
        ? farmShortLabel(selectedFarmKey)
        : hubFarmSummaries[0]
          ? farmShortLabel(hubFarmSummaries[0].farmKey)
          : "농장 없음")
    );
  })();

  const splitHubPositionLabel =
    triageFarms.length > 0
      ? `${Math.max(triageIndex, 0) + 1} / ${triageFarms.length}`
      : hubFarmSummaries.length > 0
        ? `${hubFarmSummaries.length}개 농장`
        : "—";

  const goSpAt = (index: number) => {
    const item = spNavQueue[index];
    if (!item) return;
    const reading = pickReadingForSp(readings, item.spCode, farmId || undefined);
    if (!reading) return;
    navigateToController({
      farmKey: reading.farmKey,
      spCode: normalizeStallTyCode(reading.stallTyCode),
      stallKey: stallKeyFromReading(reading),
      readingKey: reading.key,
    });
  };

  const goPrevBarn = () => {
    if (spNavQueue.length === 0) return;
    const idx =
      spNavIndex <= 0 ? spNavQueue.length - 1 : spNavIndex - 1;
    goSpAt(idx);
  };

  const goNextBarn = () => {
    if (spNavQueue.length === 0) return;
    const idx =
      spNavIndex < 0 ? 0 : (spNavIndex + 1) % spNavQueue.length;
    goSpAt(idx);
  };

  const farmerSplitTitle =
    selectedFarmKey != null
      ? farmShortLabel(selectedFarmKey)
      : farmOptions[0]?.label ?? "내 농장";

  const farmerSplitSubtitle =
    spNavQueue.length > 0
      ? [
          `${Math.max(spNavIndex, 0) + 1} / ${spNavQueue.length}`,
          spNavQueue[Math.max(spNavIndex, 0)]?.label,
          spNavQueue[Math.max(spNavIndex, 0)]?.alarmCount
            ? `${spNavQueue[Math.max(spNavIndex, 0)]!.alarmCount}건`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;

  const mobileAlarmStrip = (
    <OpsMobileAlarmStrip
      alarms={hubAlarms}
      activeAlarmId={urlAlarm}
      onSelect={navigateToAlarm}
      density="compact"
      limitVisible={false}
      embedded
    />
  );

  const mobileSplitHeader = mobileAlarmStrip;

  const handleControllerSelect = (key: string) => {
    const ctrl = controllerList.find((r) => r.key === key);
    if (!ctrl || !selectedFarmKey) return;
    navigateToController({
      farmKey: selectedFarmKey,
      spCode: normalizeStallTyCode(ctrl.stallTyCode),
      stallKey: stallKeyFromReading(ctrl),
      readingKey: key,
    });
  };

  useEffect(() => {
    if (!urlAlarm) return;
    const alarm = alarms.find((a) => a.id === urlAlarm);
    if (!alarm) {
      if (selected) {
        syncUrl(selectedFarmKey, spCode, stallKey, selected, null);
      }
      return;
    }
    if (
      !selected ||
      farmKeyId(alarm.farmKey) !== farmId ||
      alarm.controllerKey !== selected.controllerKey
    ) {
      navigateToAlarm(alarm);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- alarm deep-link bootstrap
  }, [urlAlarm]);

  useEffect(() => {
    if (geoHubMode) {
      if (!urlFarmId) return;
      if (!urlCtrl) return;
    } else if (isAdmin && !urlFarmId) {
      return;
    }
    if (!urlFarmKey && farmId && spCode && selected) {
      syncUrl(selectedFarmKey, spCode, stallKey, selected, urlAlarm ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount URL bootstrap only
  }, []);

  useEffect(() => {
    if (!geoHubMode || autoTriageBooted.current) return;
    autoTriageBooted.current = true;
    if (urlFarmId && controllerKey) return;
    if (
      isGeoHubFarmGridUrl(geoHubMode, urlFarmId, urlCtrl, urlSp, urlStall)
    ) {
      setHubFarmId(urlFarmId!);
      setHubPhase("farm");
      setFarmId(urlFarmId!);
      return;
    }
    // bare /farm?tab=ops — overview 유지 (자동 drill 금지)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- geo hub triage bootstrap once
  }, [geoHubMode, triageFarms.length, hubFarmSummaries.length, urlFarmId, controllerKey]);

  useEffect(() => {
    if (geoHubMode || autoFarmerBarnBooted.current) return;
    autoFarmerBarnBooted.current = true;
    if (controllerKey) return;
    if (spTriageQueue.length > 0) {
      const item = spTriageQueue[0]!;
      const reading = pickReadingForSp(
        readings,
        item.spCode,
        farmId || undefined
      );
      if (reading) {
        navigateToController({
          farmKey: reading.farmKey,
          spCode: normalizeStallTyCode(reading.stallTyCode),
          stallKey: stallKeyFromReading(reading),
          readingKey: reading.key,
        });
      }
      return;
    }
    const firstReading = readings.find(
      (r) => normalizeStallTyCode(r.stallTyCode) !== "UNK"
    );
    if (firstReading) {
      navigateToController({
        farmKey: firstReading.farmKey,
        spCode: normalizeStallTyCode(firstReading.stallTyCode),
        stallKey: stallKeyFromReading(firstReading),
        readingKey: firstReading.key,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- farmer sp bootstrap once
  }, [geoHubMode, spTriageQueue.length, controllerKey, readings.length]);

  const showHubFarmMap = geoHubMode && Boolean(hubFarmId);

  const showAdminPlaceholder = geoHubMode
    ? !hubFarmId
    : adminAllNoFarm && !farmId;

  const activeMapFarmId = geoHubMode ? hubFarmId : farmId || null;

  const hubControllerBundle = useMemo(
    (): ControllerGridData => ({
      readings,
      thermoSettings,
      commands: commands ?? [],
      canCommand,
      alarmSettings,
    }),
    [readings, thermoSettings, commands, canCommand, alarmSettings]
  );

  const scopedMobileFarmReadings = useMemo(() => {
    if (!farmId) return readings;
    return readings.filter((r) => farmKeyId(r.farmKey) === farmId);
  }, [farmId, readings]);

  const handleMobileSpSelect = (sp: string) => {
    const reading = pickReadingForSp(readings, sp, farmId || undefined);
    if (!reading) return;
    navigateToController({
      farmKey: reading.farmKey,
      spCode: normalizeStallTyCode(reading.stallTyCode),
      stallKey: stallKeyFromReading(reading),
      readingKey: reading.key,
    });
  };

  const mobileStallOptions = useMemo(() => {
    if (!farmId || !spCode) return [];
    return uniqueStallKeys(readings, farmId, spCode).map((key) => ({
      value: key,
      label: key.startsWith("__") ? key.replace(/^__idx_/, "#") : key,
    }));
  }, [readings, farmId, spCode]);

  const handleMobileStallSelect = (key: string) => {
    const ctrls = filterControllersForScope(readings, farmId, spCode, key);
    const ctrl = ctrls[0];
    if (!ctrl) return;
    navigateToController({
      farmKey: ctrl.farmKey,
      spCode: normalizeStallTyCode(ctrl.stallTyCode),
      stallKey: key,
      readingKey: ctrl.key,
    });
  };

  const mobileScopePills = {
    stallOptions: mobileStallOptions,
    selectedStallKey: stallKey,
    onStallSelect: handleMobileStallSelect,
  };

  const mobileSpPicker =
    geoHubMode && (!farmId || showAdminPlaceholder) ? null : (
      <div className="space-y-1.5">
        <p className="px-0.5 text-xs font-semibold text-muted-foreground">
          축사유형
        </p>
        <OpsMobileSpOverview
          readings={scopedMobileFarmReadings}
          selectedSpCode={spCode}
          onSelectSp={handleMobileSpSelect}
        />
      </div>
    );

  const showMobileHubPicker =
    geoHubMode && isMobile && !hubFarmId;

  const mobileFarmPicker = showMobileHubPicker ? (
      <div className="flex min-h-0 flex-col gap-2">
        <p className="px-2 text-xs font-semibold text-muted-foreground">
          농장목록 · 축사 · 컨트롤러
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          <HierarchyAlarmTree
            alarms={hubAlarms}
            readings={hubReadings}
            farmSummaries={hubFarmSummaries}
            selectedControllerKey={selected?.key}
            onControllerSelect={(payload) => navigateToController(payload)}
            selectedFarmId={hubFarmId}
            onFarmSelect={handleHubFarmSelect}
          />
        </div>
      </div>
    ) : null;

  const farmListColumn = (
    <SectionCard
      title="농장목록"
      size="lg"
      description={
        showAdminPlaceholder
          ? "농장·축사·컨트롤러를 펼친 뒤 선택하세요"
          : showHubFarmMap
            ? "우측 · farmer형 농장 지도"
            : farmScopeCount > 0 || hubAlarms.length > 0
            ? [
                farmScopeCount > 0 ? `${farmScopeCount}개 농장` : null,
                hubAlarms.length > 0 ? `${hubAlarms.length}건 알람` : null,
                activeSido
                  ? activeSido.replace(/특별자치도|특별자치시|광역시|도$/g, "")
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
      }
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden pt-0"
    >
      <div className="min-h-0 flex-1 overflow-y-auto">
        <HierarchyAlarmTree
          alarms={hubAlarms}
          readings={hubReadings}
          farmSummaries={hubFarmSummaries}
          selectedControllerKey={selected?.key}
          onControllerSelect={(payload) => navigateToController(payload)}
          selectedFarmId={geoHubMode && !isMobile ? hubFarmId : null}
          onFarmSelect={geoHubMode && !isMobile ? handleHubFarmSelect : undefined}
        />
      </div>
    </SectionCard>
  );

  const mapColumn = geoHub ? (
    <AdminFarmOverview
      layout="hub"
      farms={geoHub.farmSummaries}
      locations={geoHub.locations}
      activeSido={activeSido}
      onSelectSido={handleSelectSido}
      variant={mapMini ? "mini" : "full"}
      onExpand={mapMini ? handleMapExpand : undefined}
      focusFarmId={geoHubMode && isMobile ? farmId || null : null}
      onSelectFarm={geoHubMode && isMobile ? handleMapFarmSelect : undefined}
    />
  ) : null;


  const opsTriageGridClass = geoHubMode
    ? cn(
        "max-md:hidden gap-4 md:grid md:h-[calc(100vh-9rem)] md:max-h-[calc(100vh-9rem)] md:min-h-[360px] md:items-stretch md:overflow-hidden",
        "transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        stackListUnderMap
          ? "md:grid-cols-[minmax(280px,28%)_minmax(0,1fr)] lg:grid-cols-[minmax(300px,26%)_minmax(560px,1fr)]"
          : "md:grid-cols-[minmax(260px,26%)_minmax(220px,24%)_minmax(0,1fr)] lg:grid-cols-[minmax(280px,22%)_minmax(240px,20%)_minmax(480px,1fr)]"
      )
    : "max-md:hidden gap-4 md:grid md:h-[calc(100vh-9rem)] md:max-h-[calc(100vh-9rem)] md:grid-cols-[minmax(400px,28%)_minmax(0,1fr)] md:items-stretch md:overflow-hidden";

  const columnShellClass =
    "max-h-[calc(100vh-9rem)] min-h-[360px] min-w-0 overflow-hidden";

  const columnScrollShellClass = cn(
    columnShellClass,
    "flex h-full min-h-0 flex-col overflow-hidden"
  );

  const hubLeftRailClass = cn(
    columnScrollShellClass,
    stackListUnderMap && "flex flex-col gap-2"
  );

  const mapColumnShellClass = geoHubMode
    ? stackListUnderMap
      ? "shrink-0 self-start min-h-0 w-full overflow-hidden"
      : cn(columnScrollShellClass, mapMini ? "self-start" : "self-stretch")
    : columnScrollShellClass;

  const listStackShellClass = cn(
    "min-h-0 flex-1 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
    stackListUnderMap
      ? "max-h-full translate-y-0 opacity-100"
      : "pointer-events-none max-h-0 opacity-0"
  );

  const controllerColumnShellClass = columnScrollShellClass;

  const opsControllerBundle = hubControllerBundle;

  const renderFarmMapPanel = (embedded = false) =>
    activeMapFarmId ? (
      <AdminHubFarmMapPanel
        farmId={activeMapFarmId}
        readings={readings}
        layoutPrefs={hubLayoutPrefs}
        controller={opsControllerBundle}
        embedded={embedded}
        deepLinkSp={controllerKey ? spCode : null}
        deepLinkStallNo={controllerKey ? stallKey : null}
      />
    ) : null;

  const controllerColumn = showAdminPlaceholder ? (
    <AdminControllerPlaceholderClient />
  ) : (
    renderFarmMapPanel(false) ?? <AdminControllerPlaceholderClient />
  );

  const mobileSplitControl = showAdminPlaceholder ? (
    <AdminControllerPlaceholderClient />
  ) : geoHubMode && hubFarmId ? (
    <p className={cn("py-8 text-center text-muted-foreground", dashboardUi.body)}>
      상단 축사 카드를 선택하면 그래프·컨트롤러를 바로 열 수 있습니다.
    </p>
  ) : (
    renderFarmMapPanel(true) ?? (
      <p className={cn("py-8 text-center text-muted-foreground", dashboardUi.body)}>
        농장을 선택하면 in-grid 컨트롤러를 사용할 수 있습니다.
      </p>
    )
  );

  const mobileHubTopPanel =
    showHubFarmMap && hubFarmId ? (
      <AdminHubFarmMapPanel
        farmId={hubFarmId}
        readings={readings}
        layoutPrefs={hubLayoutPrefs}
        controller={hubControllerBundle}
        embedded
        deepLinkSp={controllerKey ? spCode : null}
        deepLinkStallNo={controllerKey ? stallKey : null}
      />
    ) : (
      mapColumn
    );

  const mobileHubTopVariant = showHubFarmMap ? ("grid" as const) : ("map" as const);
  const mobileHubTopMapCompact =
    !showHubFarmMap && hubPhase === "region";

  return (
    <>
      {settingsNotice ? (
        <p
          className={cn(
            "rounded-xl border px-5 py-4",
            dashboardUi.body,
            settingsNotice.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {settingsNotice.text}
        </p>
      ) : null}

      <div
        className={opsTriageGridClass}
        data-audit-region="ops-hub-desktop-grid"
        data-audit-stack={stackListUnderMap ? "1" : "0"}
      >
        {geoHubMode ? (
          <div className={hubLeftRailClass}>
            <div className={mapColumnShellClass}>{mapColumn}</div>
            {stackListUnderMap ? (
              <div className={listStackShellClass}>{farmListColumn}</div>
            ) : null}
          </div>
        ) : null}
        {!stackListUnderMap ? (
          <div className={columnScrollShellClass}>{farmListColumn}</div>
        ) : null}
        <div
          className={cn(
            controllerColumnShellClass,
            showAdminPlaceholder && "pointer-events-none opacity-50"
          )}
        >
          {controllerColumn}
        </div>
      </div>

      <div className="md:hidden">
        {geoHubMode ? (
          showHubFarmMap && hubFarmId ? (
            <OpsMobileFarmGridOnly
              title={splitHubFarmLabel}
              subtitle={[splitHubPositionLabel, activeTriageFarm && activeTriageFarm.alarmCount > 0 ? `${activeTriageFarm.alarmCount}건 알람` : null]
                .filter(Boolean)
                .join(" · ")}
              nav={
                triageFarms.length > 1
                  ? {
                      hasPrev: true,
                      hasNext: true,
                      onPrev: goPrevTriageFarm,
                      onNext: goNextTriageFarm,
                    }
                  : undefined
              }
              headerSlot={mobileSplitHeader}
              grid={mobileHubTopPanel}
              navSweepDirection={navSweepDirection}
            />
          ) : (
            <OpsMobileSplitHub
              farmLabel={splitHubFarmLabel}
              positionLabel={splitHubPositionLabel}
              alarmHint={
                activeTriageFarm && activeTriageFarm.alarmCount > 0
                  ? `${activeTriageFarm.alarmCount}건 알람`
                  : undefined
              }
              hasPrev={triageFarms.length > 1}
              hasNext={triageFarms.length > 1}
              onPrev={goPrevTriageFarm}
              onNext={goNextTriageFarm}
              map={mobileHubTopPanel}
              topVariant={mobileHubTopVariant}
              topMapCompact={mobileHubTopMapCompact}
              control={
                showAdminPlaceholder ? (
                  <AdminControllerPlaceholderClient />
                ) : null
              }
              headerSlot={mobileSplitHeader}
              placeholder={showAdminPlaceholder}
              pickerPanel={mobileFarmPicker}
              navSweepDirection={navSweepDirection}
            />
          )
        ) : (
          <OpsMobileSplitShell
            title={farmerSplitTitle}
            subtitle={farmerSplitSubtitle}
            nav={
              spNavQueue.length > 1
                ? {
                    hasPrev: true,
                    hasNext: true,
                    onPrev: goPrevBarn,
                    onNext: goNextBarn,
                    prevLabel: "이전 축사",
                    nextLabel: "다음 축사",
                  }
                : undefined
            }
            topPanel={mobileSpPicker}
            topVariant="grid"
            control={mobileSplitControl}
            headerSlot={mobileSplitHeader}
            {...mobileScopePills}
            controllerList={controllerList}
            selectedControllerKey={selected?.key}
            onControllerSelect={handleControllerSelect}
            placeholder={showAdminPlaceholder}
          />
        )}
      </div>
    </>
  );
}
