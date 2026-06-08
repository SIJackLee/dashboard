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

export function ControllersView({
  readings,
}: {
  readings: ControllerReading[];
}) {
  const router = useRouter();

  const farmOptions = useMemo(
    () => uniqueOptions(readings.map((r) => r.farmUid), "농장"),
    [readings]
  );

  const [farm, setFarm] = useState(farmOptions[0]?.value ?? "");

  const moduleOptions = useMemo(
    () =>
      uniqueOptions(
        readings.filter((r) => String(r.farmUid) === farm).map((r) => r.moduleUid),
        "모듈"
      ),
    [readings, farm]
  );

  const [module, setModule] = useState(moduleOptions[0]?.value ?? "");

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
