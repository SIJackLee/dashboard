"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CascadeSelector, type Option } from "./cascade-selector";
import { ControllerDetailPanel } from "./controller-detail-panel";
import { ControllerListPanel } from "./controller-list-panel";
import type { ControllerReading } from "@/lib/data/iot";

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
}: {
  readings: ControllerReading[];
  initialFarm?: string;
  initialModule?: string;
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

  const [controllerKey, setControllerKey] = useState(
    controllerOptions[0]?.value ?? ""
  );

  const selected =
    controllerList.find((r) => r.key === controllerKey) ?? controllerList[0];

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
    )?.key;
    setControllerKey(firstCtrl ?? "");
  };

  const handleModuleChange = (v: string) => {
    setModule(v);
    const firstCtrl = readings.find(
      (r) => String(r.farmUid) === farm && String(r.moduleUid) === v
    )?.key;
    setControllerKey(firstCtrl ?? "");
  };

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
        onControllerChange={setControllerKey}
        onRefresh={() => router.refresh()}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ControllerDetailPanel reading={selected} />
        <ControllerListPanel
          items={controllerList}
          selectedKey={selected?.key}
          onSelect={setControllerKey}
        />
      </div>
    </>
  );
}
