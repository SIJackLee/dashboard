"use client";

import { useMemo, useState } from "react";
import { ReplayHistoryPanel } from "@/components/controllers/replay-history-panel";
import { LogTable } from "@/components/logs/log-table";
import { SimpleSelect } from "@/components/common/filter-bar";
import type { BarnReading } from "@/lib/data/iot";
import type { LogEvent, ReplayControllerRow } from "@/lib/data/iot-replay";
import { farmKeyId } from "@/lib/data/farm-key";
import {
  filterReadingsByFarmAndSp,
  uniqueSpCodes,
} from "@/lib/data/reading-hierarchy";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { formatControllerSlotLabel } from "@/lib/ui/controller-labels";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

type Props = {
  readings: BarnReading[];
  replayRows: ReplayControllerRow[];
  logEvents: LogEvent[];
};

export function ReplaySettingsPanel({ readings, replayRows, logEvents }: Props) {
  const farmOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of readings) {
      const id = farmKeyId(r.farmKey);
      if (!seen.has(id)) seen.set(id, farmShortLabel(r.farmKey));
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [readings]);

  const [farmId, setFarmId] = useState(farmOptions[0]?.value ?? "");
  const spOptions = useMemo(
    () =>
      uniqueSpCodes(readings, farmId).map((code) => ({
        value: code,
        label: formatStallTypeLabel(code),
      })),
    [readings, farmId]
  );
  const [spCode, setSpCode] = useState(spOptions[0]?.value ?? "");

  const controllers = useMemo(
    () => filterReadingsByFarmAndSp(readings, farmId, spCode),
    [readings, farmId, spCode]
  );
  const [selectedKey, setSelectedKey] = useState(
    controllers[0]?.controllerKey ?? ""
  );

  const selected =
    controllers.find((c) => c.controllerKey === selectedKey) ?? controllers[0];
  const selectedRows = selected
    ? replayRows.filter(
        (r) =>
          farmKeyId(r.farmKey) === farmId &&
          (r.controllerKey === selected.controllerKey ||
            (r.idx != null && r.idx === selected.idx))
      )
    : [];

  const ctrlOptions = controllers.map((c) => ({
    value: c.controllerKey,
    label: formatControllerSlotLabel({
      stallNo: c.stallNo,
      eqpmnNo: c.eqpmnNo,
      idx: c.idx,
    }),
  }));

  return (
    <div className="space-y-6">
      <LogTable events={logEvents} />
      <div className="flex flex-wrap gap-3">
        <SimpleSelect
          options={farmOptions}
          value={farmId}
          onValueChange={(v) => {
            if (!v) return;
            setFarmId(v);
            const nextSp = uniqueSpCodes(readings, v)[0] ?? "";
            setSpCode(nextSp);
            const list = filterReadingsByFarmAndSp(readings, v, nextSp);
            setSelectedKey(list[0]?.controllerKey ?? "");
          }}
        />
        <SimpleSelect
          options={spOptions}
          value={spCode}
          onValueChange={(v) => {
            if (!v) return;
            setSpCode(v);
            const list = filterReadingsByFarmAndSp(readings, farmId, v);
            setSelectedKey(list[0]?.controllerKey ?? "");
          }}
        />
        <SimpleSelect
          options={ctrlOptions}
          value={selectedKey}
          onValueChange={(v) => v && setSelectedKey(v)}
        />
      </div>
      {selected ? (
        <ReplayHistoryPanel
          rows={selectedRows}
          farmKey={selected.farmKey}
          moduleUid={selected.moduleUid}
          controllerKey={selected.controllerKey}
          stallNo={selected.stallNo}
          eqpmnNo={selected.eqpmnNo}
        />
      ) : (
        <p className={dashboardUi.body}>선택 가능한 컨트롤러가 없습니다.</p>
      )}
    </div>
  );
}
