import { PageShell } from "@/components/layout/page-shell";
import { SettingsTabNav } from "@/components/settings/settings-tab-nav";
import { DisplaySettingsForm } from "@/components/settings/display-settings-form";
import { DataCollectionForm } from "@/components/settings/data-collection-form";
import { AlarmThresholdForm } from "@/components/settings/alarm-threshold-form";
import { ControllerMetaForm } from "@/components/settings/controller-meta-form";
import { MqttConfigForm } from "@/components/settings/mqtt-config-form";
import { LiveSummaryPanel } from "@/components/settings/live-summary-panel";

export default function SettingsPage() {
  return (
    <PageShell title="설정">
      <SettingsTabNav />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <DisplaySettingsForm />
          <DataCollectionForm />
          <AlarmThresholdForm />
          <ControllerMetaForm />
          <MqttConfigForm />
          <div className="flex justify-end gap-2">
            <button className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
              초기화
            </button>
            <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              저장
            </button>
          </div>
        </div>
        <LiveSummaryPanel />
      </div>
    </PageShell>
  );
}
