"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CascadeSelector, type Option } from "./cascade-selector";
import { ControllerDetailPanel } from "./controller-detail-panel";
import { ControllerListPanel } from "./controller-list-panel";
import { CommandPanel } from "./command-panel";
import { CommandHistoryTable } from "./command-history-table";
import { ReplayHistoryPanel } from "./replay-history-panel";
import type { ControllerReading } from "@/lib/data/iot";
import type { ReplayControllerRow } from "@/lib/data/iot-replay";
import type { ThermoCommand } from "@/lib/data/commands";
import {
  appendFarmKeyParams,
  farmKeyEq,
  farmKeyId,
  parseFarmKeyFromQuery,
  type FarmKey,
} from "@/lib/data/farm-key";

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
      label: `${fk.lsindRegistNo} / ${fk.itemCode}`,
    }));
}

function uniqueModuleOptions(
  readings: ControllerReading[],
  farmId: string
): Option[] {
  return [...new Set(
    readings
      .filter((r) => farmKeyId(r.farmKey) === farmId)
      .map((r) => r.moduleUid)
  )]
    .sort((a, b) => a - b)
    .map((v) => ({ value: String(v), label: `통신박스 ${v}` }));
}

function pickInitial(
  options: Option[],
  preferred: string | undefined
): string {
  if (preferred && options.some((o) => o.value === preferred)) return preferred;
  return options[0]?.value ?? "";
}

export function ControllersView({
  readings,
  replayHistory = [],
  initialLsind,
  initialItem,
  initialModule,
  initialCtrl,
  canCommand,
  commands = [],
}: {
  readings: ControllerReading[];
  replayHistory?: ReplayControllerRow[];
  initialLsind?: string;
  initialItem?: string;
  initialModule?: string;
  initialCtrl?: string;
  canCommand: boolean;
  commands?: ThermoCommand[];
}) {
  const router = useRouter();
  const initialFarmKey = parseFarmKeyFromQuery(initialLsind, initialItem);
  const initialFarmId = initialFarmKey ? farmKeyId(initialFarmKey) : undefined;

  const farmOptions = useMemo(
    () => uniqueFarmOptions(readings),
    [readings]
  );

  const [farmId, setFarmId] = useState(() =>
    pickInitial(farmOptions, initialFarmId)
  );

  const selectedFarmKey = useMemo((): FarmKey | undefined => {
    const hit = readings.find((r) => farmKeyId(r.farmKey) === farmId);
    return hit?.farmKey;
  }, [readings, farmId]);

  const moduleOptions = useMemo(
    () => uniqueModuleOptions(readings, farmId),
    [readings, farmId]
  );

  const [module, setModule] = useState(() => {
    const f = pickInitial(farmOptions, initialFarmId);
    const mods = uniqueModuleOptions(readings, f);
    return pickInitial(mods, initialModule);
  });

  const controllerList = useMemo(
    () =>
      readings
        .filter(
          (r) =>
            farmKeyId(r.farmKey) === farmId && String(r.moduleUid) === module
        )
        .sort((a, b) => a.idx - b.idx),
    [readings, farmId, module]
  );

  const moduleReplayHistory = useMemo(
    () =>
      replayHistory.filter(
        (r) =>
          farmKeyId(r.farmKey) === farmId && String(r.moduleUid) === module
      ),
    [replayHistory, farmId, module]
  );

  const controllerOptions = useMemo(
    () => controllerList.map((r) => ({ value: r.key, label: r.label })),
    [controllerList]
  );

  const pickCtrlKey = (list: ControllerReading[], preferredIdx?: string) => {
    if (preferredIdx !== undefined) {
      const hit = list.find((r) => r.idx === Number(preferredIdx));
      if (hit) return hit.key;
    }
    return list[0]?.key ?? "";
  };

  const [controllerKey, setControllerKey] = useState(() => {
    const f = pickInitial(farmOptions, initialFarmId);
    const m = pickInitial(uniqueModuleOptions(readings, f), initialModule);
    return pickCtrlKey(
      readings.filter(
        (r) => farmKeyId(r.farmKey) === f && String(r.moduleUid) === m
      ),
      initialCtrl
    );
  });

  const selected =
    controllerList.find((r) => r.key === controllerKey) ?? controllerList[0];

  const selectedReplayRows = useMemo(
    () =>
      selected
        ? moduleReplayHistory.filter((r) => r.idx === selected.idx)
        : [],
    [moduleReplayHistory, selected]
  );

  const syncUrl = (
    fk: FarmKey | undefined,
    m: string,
    ctrl: ControllerReading | undefined
  ) => {
    const params = new URLSearchParams();
    if (fk) appendFarmKeyParams(params, fk);
    if (m) params.set("module", m);
    if (ctrl) params.set("ctrl", String(ctrl.idx));
    router.replace(`/controllers?${params.toString()}`, { scroll: false });
  };

  const handleFarmChange = (v: string) => {
    setFarmId(v);
    const fk = readings.find((r) => farmKeyId(r.farmKey) === v)?.farmKey;
    const firstModule = uniqueModuleOptions(readings, v)[0]?.value;
    const nextModule = firstModule ?? "";
    setModule(nextModule);
    const list = readings.filter(
      (r) => farmKeyId(r.farmKey) === v && String(r.moduleUid) === nextModule
    );
    const firstCtrl = list[0];
    setControllerKey(firstCtrl?.key ?? "");
    syncUrl(fk, nextModule, firstCtrl);
  };

  const handleModuleChange = (v: string) => {
    setModule(v);
    const list = readings.filter(
      (r) => farmKeyId(r.farmKey) === farmId && String(r.moduleUid) === v
    );
    const firstCtrl = list[0];
    setControllerKey(firstCtrl?.key ?? "");
    syncUrl(selectedFarmKey, v, firstCtrl);
  };

  const handleControllerChange = (key: string) => {
    setControllerKey(key);
    const ctrl = controllerList.find((r) => r.key === key);
    syncUrl(selectedFarmKey, module, ctrl);
  };

  useEffect(() => {
    if (!initialFarmKey && farmId && module && selected) {
      syncUrl(selectedFarmKey, module, selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount URL bootstrap only
  }, []);

  return (
    <>
      <CascadeSelector
        farmOptions={farmOptions}
        moduleOptions={moduleOptions}
        controllerOptions={controllerOptions}
        farm={farmId}
        module={module}
        controller={selected?.key ?? ""}
        onFarmChange={handleFarmChange}
        onModuleChange={handleModuleChange}
        onControllerChange={handleControllerChange}
        onRefresh={() => router.refresh()}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ControllerDetailPanel reading={selected} />
        <ControllerListPanel
          items={controllerList}
          selectedKey={selected?.key}
          onSelect={handleControllerChange}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CommandPanel target={selected} canCommand={canCommand} />
        <CommandHistoryTable commands={commands} />
      </div>
      {selected && selectedFarmKey && (
        <ReplayHistoryPanel
          rows={selectedReplayRows}
          farmKey={selectedFarmKey}
          moduleUid={Number(module)}
          ctrlIdx={selected.idx}
        />
      )}
    </>
  );
}
