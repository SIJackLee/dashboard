"use client";

import { useState } from "react";
import { DisplaySettingsForm } from "./display-settings-form";
import { DataCollectionForm } from "./data-collection-form";
import { AlarmThresholdForm } from "./alarm-threshold-form";
import { ControllerMetaForm } from "./controller-meta-form";
import { MqttConfigForm } from "./mqtt-config-form";
import { LiveSummaryPanel } from "./live-summary-panel";
import { BarnMetaForm } from "./barn-meta-form";
import { SettingsTabNav, type SettingsTabId } from "./settings-tab-nav";
import type { BarnMeta } from "@/lib/data/barn-meta";
import type { StallCatalogEntry } from "@/lib/data/stall-catalog";
import type { BarnReading } from "@/lib/data/iot";
import type { LiveSummary } from "@/lib/data/iot-live";
import type { ControllerMetaEntry } from "@/lib/data/controller-meta";

type Props = {
  barnMetas: BarnMeta[];
  stallCatalog: StallCatalogEntry[];
  readings: BarnReading[];
  liveSummary: LiveSummary;
  controllerMetas: ControllerMetaEntry[];
  barnNotice?: { tone: "ok" | "error"; text: string } | null;
  controllerNotice?: { tone: "ok" | "error"; text: string } | null;
  initialTab?: SettingsTabId;
};

export function SettingsView({
  barnMetas,
  stallCatalog,
  readings,
  liveSummary,
  controllerMetas,
  barnNotice,
  controllerNotice,
  initialTab = "dashboard",
}: Props) {
  const [tab, setTab] = useState<SettingsTabId>(initialTab);

  return (
    <>
      <SettingsTabNav active={tab} onChange={setTab} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {tab === "dashboard" && (
            <>
              <DisplaySettingsForm />
              <DataCollectionForm />
              <AlarmThresholdForm />
            </>
          )}
          {tab === "farm" && (
            <p className="rounded-md border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              농장 설정은 추후 구현 예정입니다.
            </p>
          )}
          {tab === "barn" && (
            <BarnMetaForm
              initialBarns={barnMetas}
              stallCatalog={stallCatalog}
              notice={barnNotice}
            />
          )}
          {tab === "controller" && (
            <ControllerMetaForm
              readings={readings}
              initialMetas={controllerMetas}
              notice={controllerNotice}
            />
          )}
          {tab === "alarm" && (
            <p className="rounded-md border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              알람 설정은 추후 구현 예정입니다.
            </p>
          )}
          {tab === "log" && (
            <p className="rounded-md border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
              로그 설정은 추후 구현 예정입니다.
            </p>
          )}
          {tab === "dashboard" && (
            <>
              <MqttConfigForm />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                >
                  초기화
                </button>
                <button
                  type="button"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  저장
                </button>
              </div>
            </>
          )}
        </div>
        <LiveSummaryPanel summary={liveSummary} />
      </div>
    </>
  );
}
