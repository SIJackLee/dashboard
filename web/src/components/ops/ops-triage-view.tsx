"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  HierarchyAlarmTree,
  type ControllerSelectPayload,
} from "@/components/ops/hierarchy-alarm-tree";
import { SectionCard } from "@/components/common/section-card";
import { ScopeBar } from "@/components/layout/scope-bar";
import type { ControllerReading } from "@/lib/data/iot";
import type { AlarmRow } from "@/lib/data/alarms";
import type { AlarmSettings } from "@/lib/data/alarms";
import { buildControllerHref } from "@/lib/auth/farm-access";
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
  buildSpNavQueue,
  buildSpTriageQueue,
  OpsMobileSpOverview,
  pickReadingForSp,
} from "@/components/ops/ops-mobile-sp-overview";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { useMobileLayout } from "@/lib/ui/use-mobile-layout";
import { cn } from "@/lib/utils";
import { OpsMobileAlarmStrip } from "@/components/ops/ops-mobile-alarm-strip";
import { OpsMobileSplitShell } from "@/components/ops/ops-mobile-split-shell";

const AdminControllerPlaceholderClient = dynamic(
  () =>
    import("@/components/admin/admin-controller-placeholder").then(
      (m) => m.AdminControllerPlaceholder
    ),
  { ssr: false }
);

const FarmScopedPanel = dynamic(
  () =>
    import("@/components/farm/farm-scoped-panel").then(
      (m) => m.FarmScopedPanel
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
  farmSummaries?: FarmSummaryRow[];
  adminFarmOptions?: FarmKey[];
  adminActiveFarmKey?: FarmKey | null;
  alarmSettings?: AlarmSettings;
  settingsNotice?: { tone: "ok" | "error"; text: string } | null;
};

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

function adminFarmOptionsAsOptions(farms: FarmKey[]): Option[] {
  return farms
    .map((fk) => ({
      value: farmKeyId(fk),
      label: farmShortLabel(fk),
    }))
    .sort((a, b) => a.value.localeCompare(b.value));
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

function resolveInitialFarmId(
  isAdmin: boolean,
  urlFarmId: string | undefined,
  adminActiveFarmKey: FarmKey | null,
  farmOptions: Option[]
): string {
  if (isAdmin && !urlFarmId && !adminActiveFarmKey) return "";
  if (urlFarmId) return urlFarmId;
  if (adminActiveFarmKey) return farmKeyId(adminActiveFarmKey);
  return pickInitial(farmOptions, urlFarmId);
}

export function OpsTriageView(props: OpsTriageViewProps) {
  return <OpsTriageViewBody {...props} />;
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
  isAdmin = false,
  farmSummaries = [],
  adminFarmOptions = [],
  adminActiveFarmKey = null,
  settingsNotice = null,
}: OpsTriageViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hubUrlEpoch, setHubUrlEpoch] = useState(0);
  const isMobile = useMobileLayout();

  const bumpHubUrl = useCallback(() => {
    setHubUrlEpoch((n) => n + 1);
  }, []);

  const urlFarmKey = parseFarmKeyFromQuery(
    searchParams.get("lsind") ?? initialLsind,
    searchParams.get("item") ?? initialItem
  );
  const urlFarmId = urlFarmKey ? farmKeyId(urlFarmKey) : undefined;
  const urlSp = searchParams.get("sp") ?? initialSp;
  const urlStall = searchParams.get("stall") ?? initialStall;
  const urlCtrl = searchParams.get("ctrl") ?? initialCtrl;
  const urlAlarm = searchParams.get("alarm") ?? initialAlarm;

  const adminNeedsFarm = isAdmin && !urlFarmId && !adminActiveFarmKey;

  const farmOptions = useMemo(() => {
    const fromReadings = uniqueFarmOptions(readings);
    if (!isAdmin || fromReadings.length > 0) return fromReadings;
    return adminFarmOptionsAsOptions(adminFarmOptions);
  }, [readings, isAdmin, adminFarmOptions]);

  const [farmId, setFarmId] = useState(() =>
    resolveInitialFarmId(isAdmin, urlFarmId, adminActiveFarmKey, farmOptions)
  );

  const [spCode, setSpCode] = useState(() => {
    if (adminNeedsFarm) return "";
    const f = resolveInitialFarmId(isAdmin, urlFarmId, adminActiveFarmKey, farmOptions);
    return pickInitialSp(spOptionsForFarm(readings, f), urlSp ?? undefined);
  });

  const [stallKey, setStallKey] = useState(() => {
    if (adminNeedsFarm) return "";
    const f = resolveInitialFarmId(isAdmin, urlFarmId, adminActiveFarmKey, farmOptions);
    const sp = pickInitialSp(spOptionsForFarm(readings, f), urlSp);
    return pickInitialStall(readings, f, sp, urlStall ?? undefined, urlCtrl);
  });

  const controllerList = useMemo(
    () => filterControllersForScope(readings, farmId, spCode, stallKey),
    [readings, farmId, spCode, stallKey]
  );

  const [controllerKey, setControllerKey] = useState(() => {
    if (adminNeedsFarm) return "";
    const f = resolveInitialFarmId(isAdmin, urlFarmId, adminActiveFarmKey, farmOptions);
    const sp = pickInitialSp(spOptionsForFarm(readings, f), urlSp);
    const stall = pickInitialStall(readings, f, sp, urlStall ?? undefined, urlCtrl);
    return pickCtrlKey(
      filterControllersForScope(readings, f, sp, stall),
      urlCtrl
    );
  });

  const selectedFarmKey = useMemo((): FarmKey | undefined => {
    const hit = readings.find((r) => farmKeyId(r.farmKey) === farmId);
    if (hit) return hit.farmKey;
    if (farmId && adminFarmOptions.length > 0) {
      return adminFarmOptions.find((f) => farmKeyId(f) === farmId);
    }
    return adminActiveFarmKey ?? undefined;
  }, [readings, farmId, adminFarmOptions, adminActiveFarmKey]);

  const selected = controllerKey
    ? controllerList.find((r) => r.key === controllerKey)
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

  const spTriageQueue = useMemo(
    () => buildSpTriageQueue(readings, globalAlarms, farmId || undefined),
    [globalAlarms, readings, farmId]
  );

  const spNavQueue = useMemo(
    () => buildSpNavQueue(readings, globalAlarms, farmId || undefined),
    [globalAlarms, readings, farmId]
  );

  const spNavIndex = useMemo(() => {
    if (!spCode || spNavQueue.length === 0) return -1;
    return spNavQueue.findIndex(
      (item) => normalizeStallTyCode(item.spCode) === normalizeStallTyCode(spCode)
    );
  }, [spNavQueue, spCode]);

  const autoFarmerBarnBooted = useRef(false);

  const farmScopeCount = useMemo(() => {
    const ids = new Set<string>();
    for (const r of readings) ids.add(farmKeyId(r.farmKey));
    for (const s of farmSummaries) ids.add(farmKeyId(s.farmKey));
    return ids.size;
  }, [readings, farmSummaries]);

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
    setMonitoringTabParam(params, "ops");
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
    syncUrl(
      payload.farmKey,
      payload.spCode,
      payload.stallKey,
      reading,
      alarmId ?? null
    );
  };

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
      alarms={globalAlarms}
      activeAlarmId={urlAlarm}
      onSelect={navigateToAlarm}
      density="compact"
      limitVisible={false}
      embedded
    />
  );

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
    if (isAdmin && !urlFarmId) return;
    if (!urlFarmKey && farmId && spCode && selected) {
      syncUrl(selectedFarmKey, spCode, stallKey, selected, urlAlarm ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount URL bootstrap only
  }, []);

  useEffect(() => {
    if (autoFarmerBarnBooted.current) return;
    autoFarmerBarnBooted.current = true;
    if (controllerKey) return;
    if (isAdmin && !farmId) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sp bootstrap once
  }, [spTriageQueue.length, controllerKey, readings.length, isAdmin, farmId]);

  const showAdminPlaceholder = isAdmin && !farmId;

  const resolvedFarmKey = useMemo((): FarmKey | null => {
    if (!farmId) return null;
    return (
      readings.find((r) => farmKeyId(r.farmKey) === farmId)?.farmKey ??
      farmSummaries.find((s) => farmKeyId(s.farmKey) === farmId)?.farmKey ??
      adminFarmOptions.find((f) => farmKeyId(f) === farmId) ??
      null
    );
  }, [farmId, readings, farmSummaries, adminFarmOptions]);

  const inGridDeepLinkSp =
    searchParams.get("view") !== "list" && urlSp && !urlCtrl
      ? normalizeStallTyCode(urlSp)
      : null;
  const inGridDeepLinkStall = urlStall && !urlCtrl ? urlStall : null;

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
    !farmId || showAdminPlaceholder ? null : (
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

  const farmListColumn = (
    <SectionCard
      title="농장목록"
      size="lg"
      description={
        showAdminPlaceholder
          ? "상단에서 FARM을 선택한 뒤 축사·컨트롤러를 펼치세요"
          : farmScopeCount > 0 || globalAlarms.length > 0
            ? [
                farmScopeCount > 0 ? `${farmScopeCount}개 농장` : null,
                globalAlarms.length > 0 ? `${globalAlarms.length}건 알람` : null,
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
          alarms={globalAlarms}
          readings={readings}
          farmSummaries={farmSummaries}
          selectedControllerKey={selected?.key}
          onControllerSelect={(payload) => navigateToController(payload)}
        />
      </div>
    </SectionCard>
  );

  const opsTriageGridClass =
    "max-md:hidden gap-4 md:grid md:h-[calc(100vh-9rem)] md:max-h-[calc(100vh-9rem)] md:grid-cols-[minmax(400px,28%)_minmax(0,1fr)] md:items-stretch md:overflow-hidden";

  const columnShellClass =
    "max-h-[calc(100vh-9rem)] min-h-[360px] min-w-0 overflow-hidden";

  const columnScrollShellClass = cn(
    columnShellClass,
    "flex h-full min-h-0 flex-col overflow-hidden"
  );

  const renderFarmMapPanel = (embedded = false) =>
    farmId && resolvedFarmKey ? (
      <FarmScopedPanel
        farmId={farmId}
        farmKey={resolvedFarmKey}
        layoutPrefs={{ layouts: {}, aliases: {} }}
        hubMode
        embedded={embedded}
        hubUrlEpoch={hubUrlEpoch}
        onHubUrlChange={bumpHubUrl}
        {...(inGridDeepLinkSp ? { deepLinkSp: inGridDeepLinkSp } : {})}
        {...(inGridDeepLinkStall ? { deepLinkStallNo: inGridDeepLinkStall } : {})}
      />
    ) : null;

  const controllerColumn = showAdminPlaceholder ? (
    <AdminControllerPlaceholderClient />
  ) : !isMobile ? (
    renderFarmMapPanel(false) ?? <AdminControllerPlaceholderClient />
  ) : (
    <AdminControllerPlaceholderClient />
  );

  const mobileSplitControl = showAdminPlaceholder ? (
    <AdminControllerPlaceholderClient />
  ) : isMobile ? (
    renderFarmMapPanel(true) ?? (
      <p className={cn("py-8 text-center text-muted-foreground", dashboardUi.body)}>
        농장을 선택하면 in-grid 컨트롤러를 사용할 수 있습니다.
      </p>
    )
  ) : null;

  const showAdminScope = isAdmin && adminFarmOptions.length > 0;

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

      {showAdminScope ? (
        <ScopeBar
          sticky
          adminFarmSwitcher={{
            farmOptions: adminFarmOptions,
            activeFarmKey: adminActiveFarmKey,
            farmSummaries,
          }}
          onRefresh={() => router.refresh()}
        />
      ) : null}

      <div
        className={opsTriageGridClass}
        data-audit-region="ops-desktop-grid"
      >
        <div className={columnScrollShellClass}>{farmListColumn}</div>
        <div
          className={cn(
            columnScrollShellClass,
            showAdminPlaceholder && "pointer-events-none opacity-50"
          )}
        >
          {controllerColumn}
        </div>
      </div>

      <div className="md:hidden">
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
          headerSlot={mobileAlarmStrip}
          {...mobileScopePills}
          controllerList={controllerList}
          selectedControllerKey={selected?.key}
          onControllerSelect={handleControllerSelect}
          placeholder={showAdminPlaceholder}
        />
      </div>
    </>
  );
}
