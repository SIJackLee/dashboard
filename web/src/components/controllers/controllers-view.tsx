"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ControllerContextBar } from "./controller-context-bar";
import { ControllerPanelFace } from "./controller-panel-face";
import { CommandHistoryTable } from "./command-history-table";
import type { ControllerReading } from "@/lib/data/iot";
import type { ThermoCommand } from "@/lib/data/commands";
import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import { resolveThermoSettings } from "@/lib/controllers/controller-settings";
import {
  appendFarmKeyParams,
  farmKeyId,
  parseFarmKeyFromQuery,
  type FarmKey,
} from "@/lib/data/farm-key";
import {
  filterReadingsByFarmAndSp,
  filterReadingsByHierarchy,
  stallLabelFromKey,
  uniqueSpCodes,
  uniqueStallKeys,
} from "@/lib/data/reading-hierarchy";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { farmShortLabel, type FarmSummaryRow } from "@/lib/data/farm-summaries";
import { useDisplayEnabled } from "@/components/display/display-settings-provider";

const AdminControllerFarmHints = dynamic(
  () =>
    import("@/components/admin/admin-controller-farm-hints").then(
      (m) => m.AdminControllerFarmHints
    ),
  { ssr: false }
);

const AdminControllerPlaceholderClient = dynamic(
  () =>
    import("@/components/admin/admin-controller-placeholder").then(
      (m) => m.AdminControllerPlaceholder
    ),
  { ssr: false }
);

type Option = { value: string; label: string };

type ControllersViewProps = {
  readings: ControllerReading[];
  initialLsind?: string;
  initialItem?: string;
  initialSp?: string;
  initialStall?: string;
  initialCtrl?: string;
  initialModule?: string;
  canCommand: boolean;
  commands?: ThermoCommand[];
  thermoSettings?: Record<string, ControllerThermoSettings>;
  isAdmin?: boolean;
  adminAllFarms?: boolean;
  farmSummaries?: FarmSummaryRow[];
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
  return uniqueStallKeys(readings, farmId, spCode).map((key) => ({
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
  if (stallKey) {
    return filterReadingsByHierarchy(readings, farmId, spCode, stallKey);
  }
  return filterReadingsByFarmAndSp(readings, farmId, spCode);
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
  const keys = uniqueStallKeys(readings, farmId, spCode);
  if (preferred && keys.includes(preferred)) return preferred;
  const fromCtrl = stallKeyFromControllerParam(ctrlParam);
  if (fromCtrl && keys.includes(fromCtrl)) return fromCtrl;
  return keys[0] ?? "";
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

/** URL 농장 스코프 변경 시 remount — soft navigation hydration 불일치 방지 */
export function ControllersView(props: ControllersViewProps) {
  const searchParams = useSearchParams();
  const scopeKey = `${searchParams.get("lsind") ?? ""}-${searchParams.get("item") ?? ""}`;
  return <ControllersViewBody key={scopeKey} {...props} />;
}

function ControllersViewBody({
  readings,
  initialLsind,
  initialItem,
  initialSp,
  initialStall,
  initialCtrl,
  canCommand,
  commands = [],
  thermoSettings = {},
  isAdmin = false,
  adminAllFarms = false,
  farmSummaries = [],
}: ControllersViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showContextBar = useDisplayEnabled("controller.contextBar");
  const showCommandHistory = useDisplayEnabled("controller.commandHistory");

  const urlFarmKey = parseFarmKeyFromQuery(
    searchParams.get("lsind") ?? initialLsind,
    searchParams.get("item") ?? initialItem
  );
  const urlFarmId = urlFarmKey ? farmKeyId(urlFarmKey) : undefined;
  const urlSp = searchParams.get("sp") ?? initialSp;
  const urlStall = searchParams.get("stall") ?? initialStall;
  const urlCtrl = searchParams.get("ctrl") ?? initialCtrl;
  const adminAllNoFarm = isAdmin && adminAllFarms && !urlFarmId;

  const farmOptions = useMemo(() => uniqueFarmOptions(readings), [readings]);

  const [farmId, setFarmId] = useState(() =>
    adminAllNoFarm ? "" : pickInitial(farmOptions, urlFarmId)
  );

  const spOptions = useMemo(
    () => spOptionsForFarm(readings, farmId),
    [readings, farmId]
  );

  const [spCode, setSpCode] = useState(() => {
    if (adminAllNoFarm) return "";
    const f = pickInitial(farmOptions, urlFarmId);
    return pickInitial(spOptionsForFarm(readings, f), urlSp);
  });

  const [stallKey, setStallKey] = useState(() => {
    if (adminAllNoFarm) return "";
    const f = pickInitial(farmOptions, urlFarmId);
    const sp = pickInitial(spOptionsForFarm(readings, f), urlSp);
    return pickInitialStall(readings, f, sp, urlStall ?? undefined, urlCtrl);
  });

  const stallOptions = useMemo(
    () => stallOptionsForFarmSp(readings, farmId, spCode),
    [readings, farmId, spCode]
  );

  const controllerList = useMemo(
    () => filterControllersForScope(readings, farmId, spCode, stallKey),
    [readings, farmId, spCode, stallKey]
  );

  const [controllerKey, setControllerKey] = useState(() => {
    if (adminAllNoFarm) return "";
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

  const selected =
    controllerList.find((r) => r.key === controllerKey) ?? controllerList[0];

  const selectedSettings = useMemo(
    () =>
      resolveThermoSettings(
        thermoSettings,
        selectedFarmKey,
        selected?.moduleUid,
        selected?.controllerKey
      ),
    [thermoSettings, selectedFarmKey, selected?.moduleUid, selected?.controllerKey]
  );

  const latestCommand = useMemo(() => {
    if (!selected || !selectedFarmKey) return null;
    return (
      commands.find(
        (c) =>
          farmKeyId(c.farmKey) === farmKeyId(selectedFarmKey) &&
          c.moduleUid === selected.moduleUid &&
          c.controllerKey === selected.controllerKey
      ) ?? null
    );
  }, [commands, selected, selectedFarmKey]);

  useEffect(() => {
    if (
      !latestCommand ||
      latestCommand.status === "applied" ||
      latestCommand.status === "failed" ||
      latestCommand.status === "cancelled"
    ) {
      return;
    }
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [latestCommand?.id, latestCommand?.status, router]);

  const syncUrl = (
    fk: FarmKey | undefined,
    sp: string,
    stall: string,
    ctrl: ControllerReading | undefined
  ) => {
    const params = new URLSearchParams();
    if (fk) appendFarmKeyParams(params, fk);
    if (sp) params.set("sp", sp);
    if (stall) params.set("stall", stall);
    if (ctrl) params.set("ctrl", encodeURIComponent(ctrl.controllerKey));
    router.replace(`/controllers?${params.toString()}`, { scroll: false });
  };

  const handleFarmChange = (v: string) => {
    setFarmId(v);
    const fk = readings.find((r) => farmKeyId(r.farmKey) === v)?.farmKey;
    const nextSp = spOptionsForFarm(readings, v)[0]?.value ?? "";
    setSpCode(nextSp);
    const nextStall = pickInitialStall(readings, v, nextSp);
    setStallKey(nextStall);
    const list = filterControllersForScope(readings, v, nextSp, nextStall);
    const firstCtrl = list[0];
    setControllerKey(firstCtrl?.key ?? "");
    syncUrl(fk, nextSp, nextStall, firstCtrl);
  };

  const handleSpChange = (v: string) => {
    setSpCode(v);
    const nextStall = pickInitialStall(readings, farmId, v);
    setStallKey(nextStall);
    const list = filterControllersForScope(readings, farmId, v, nextStall);
    const firstCtrl = list[0];
    setControllerKey(firstCtrl?.key ?? "");
    syncUrl(selectedFarmKey, v, nextStall, firstCtrl);
  };

  const handleStallChange = (v: string) => {
    setStallKey(v);
    const list = filterControllersForScope(readings, farmId, spCode, v);
    const firstCtrl = list[0];
    setControllerKey(firstCtrl?.key ?? "");
    syncUrl(selectedFarmKey, spCode, v, firstCtrl);
  };

  const handleControllerChange = (key: string) => {
    setControllerKey(key);
    const ctrl = controllerList.find((r) => r.key === key);
    syncUrl(selectedFarmKey, spCode, stallKey, ctrl);
  };

  useEffect(() => {
    if (isAdmin && adminAllFarms) return;
    if (!urlFarmKey && farmId && spCode && selected) {
      syncUrl(selectedFarmKey, spCode, stallKey, selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount URL bootstrap only
  }, []);

  const showAdminPlaceholder = adminAllNoFarm && !farmId;
  const showFarmHints =
    isAdmin && adminAllFarms && !urlFarmId && farmSummaries.length > 0;

  return (
    <>
      {showFarmHints ? (
        <AdminControllerFarmHints farms={farmSummaries} />
      ) : null}

      {showContextBar && !showAdminPlaceholder ? (
        <ControllerContextBar
          lsindRegistNo={selectedFarmKey?.lsindRegistNo ?? "—"}
          stallTypeLabel={spCode ? formatStallTypeLabel(spCode) : "—"}
          spOptions={spOptions}
          activeSp={spCode}
          stallOptions={stallOptions}
          activeStall={stallKey}
          onStallChange={handleStallChange}
          farmOptions={farmOptions}
          activeFarm={farmId}
          onSpChange={handleSpChange}
          onFarmChange={handleFarmChange}
          onRefresh={() => router.refresh()}
        />
      ) : null}

      {showAdminPlaceholder ? (
        <AdminControllerPlaceholderClient />
      ) : (
        <>
          <ControllerPanelFace
            reading={selected}
            knownSettings={selectedSettings}
            latestCommand={latestCommand}
            canCommand={canCommand}
            controllerList={controllerList}
            selectedControllerKey={selected?.key}
            onControllerSelect={handleControllerChange}
            spLabel={
              stallKey
                ? `${formatStallTypeLabel(spCode)} · ${stallLabelFromKey(stallKey)}`
                : formatStallTypeLabel(spCode)
            }
          />

          {showCommandHistory ? <CommandHistoryTable commands={commands} /> : null}
        </>
      )}
    </>
  );
}
