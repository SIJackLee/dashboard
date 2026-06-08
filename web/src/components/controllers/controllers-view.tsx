"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CascadeSelector, type Option } from "./cascade-selector";
import { ControllerDetailPanel } from "./controller-detail-panel";
import { ControllerListPanel } from "./controller-list-panel";
import { CommandPanel } from "./command-panel";
import { CommandHistoryTable } from "./command-history-table";
import type { ControllerReading } from "@/lib/data/iot";
import type { ThermoCommand } from "@/lib/data/commands";

function uniqueOptions(values: number[], prefix: string): Option[] {
  return [...new Set(values)]
    .sort((a, b) => a - b)
    .map((v) => ({ value: String(v), label: `${prefix} ${v}` }));
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
  initialFarm,
  initialModule,
  initialCtrl,
  canCommand,
  commands = [],
}: {
  readings: ControllerReading[];
  initialFarm?: string;
  initialModule?: string;
  initialCtrl?: string;
  canCommand: boolean;
  commands?: ThermoCommand[];
}) {
  const router = useRouter();

  const farmOptions = useMemo(
    () => uniqueOptions(readings.map((r) => r.farmUid), "농장"),
    [readings]
  );

  const [farm, setFarm] = useState(() =>
    pickInitial(farmOptions, initialFarm)
  );

  const moduleOptions = useMemo(
    () =>
      uniqueOptions(
        readings.filter((r) => String(r.farmUid) === farm).map((r) => r.moduleUid),
        "모듈"
      ),
    [readings, farm]
  );

  const [module, setModule] = useState(() => {
    const f = pickInitial(farmOptions, initialFarm);
    const mods = uniqueOptions(
      readings.filter((r) => String(r.farmUid) === f).map((r) => r.moduleUid),
      "모듈"
    );
    return pickInitial(mods, initialModule);
  });

  const controllerList = useMemo(
    () =>
      readings.filter(
        (r) => String(r.farmUid) === farm && String(r.moduleUid) === module
      ),
    [readings, farm, module]
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

  const [controllerKey, setControllerKey] = useState(() =>
    pickCtrlKey(
      readings.filter(
        (r) =>
          String(r.farmUid) === pickInitial(farmOptions, initialFarm) &&
          String(r.moduleUid) ===
            pickInitial(
              uniqueOptions(
                readings
                  .filter(
                    (r) =>
                      String(r.farmUid) === pickInitial(farmOptions, initialFarm)
                  )
                  .map((r) => r.moduleUid),
                "모듈"
              ),
              initialModule
            )
      ),
      initialCtrl
    )
  );

  const selected =
    controllerList.find((r) => r.key === controllerKey) ?? controllerList[0];

  const syncUrl = (f: string, m: string, ctrl: ControllerReading | undefined) => {
    const params = new URLSearchParams();
    if (f) params.set("farm", f);
    if (m) params.set("module", m);
    if (ctrl) params.set("ctrl", String(ctrl.idx));
    router.replace(`/controllers?${params.toString()}`, { scroll: false });
  };

  const handleFarmChange = (v: string) => {
    setFarm(v);
    const firstModule = uniqueOptions(
      readings.filter((r) => String(r.farmUid) === v).map((r) => r.moduleUid),
      "모듈"
    )[0]?.value;
    const nextModule = firstModule ?? "";
    setModule(nextModule);
    const firstCtrl = readings.find(
      (r) => String(r.farmUid) === v && String(r.moduleUid) === nextModule
    );
    setControllerKey(firstCtrl?.key ?? "");
    syncUrl(v, nextModule, firstCtrl);
  };

  const handleModuleChange = (v: string) => {
    setModule(v);
    const firstCtrl = readings.find(
      (r) => String(r.farmUid) === farm && String(r.moduleUid) === v
    );
    setControllerKey(firstCtrl?.key ?? "");
    syncUrl(farm, v, firstCtrl);
  };

  const handleControllerChange = (key: string) => {
    setControllerKey(key);
    const ctrl = controllerList.find((r) => r.key === key);
    syncUrl(farm, module, ctrl);
  };

  // 최초 진입 시 URL 없으면 현재 선택을 쿼리에 반영 (명령 대상·딥링크)
  useEffect(() => {
    if (!initialFarm && farm && module && selected) {
      syncUrl(farm, module, selected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount URL bootstrap only
  }, []);

  return (
    <>
      <CascadeSelector
        farmOptions={farmOptions}
        moduleOptions={moduleOptions}
        controllerOptions={controllerOptions}
        farm={farm}
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
    </>
  );
}
