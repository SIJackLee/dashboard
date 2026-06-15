import { PageShell } from "@/components/layout/page-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { getAlarmSettings } from "@/lib/data/alarm-settings";
import { getDisplaySettings } from "@/lib/data/display-settings";
import { getEditableFarmLocationOptions } from "@/lib/data/farm-location";
import { getPiggyPlayerId } from "@/lib/data/piggy-settings";
import { buildStallCatalog, getLiveReadings } from "@/lib/data/iot";
import { resolveSettingsTab } from "@/lib/dashboard-sections";

const notices: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "저장했습니다." },
  invalid: { tone: "error", text: "입력값이 올바르지 않습니다." },
  save: { tone: "error", text: "저장에 실패했습니다. 권한을 확인하세요." },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ok?: string; error?: string }>;
}) {
  const { tab, ok, error } = await searchParams;
  const [readings, alarmSettings, displaySettings, piggyPlayerId, farmLocationOptions] =
    await Promise.all([
      getLiveReadings(),
      getAlarmSettings(),
      getDisplaySettings(),
      getPiggyPlayerId(),
      getEditableFarmLocationOptions(),
    ]);
  const stallCatalog = buildStallCatalog(readings);
  const initialTab = resolveSettingsTab(tab);
  const notice = ok ? notices[ok] : error ? notices[error] : null;

  return (
    <PageShell title="설정">
      <SettingsView
        stallCatalog={stallCatalog}
        readings={readings}
        alarmSettings={alarmSettings}
        displaySettings={displaySettings}
        alarmNotice={initialTab === "alarm" ? notice : null}
        displayNotice={initialTab === "dashboard" ? notice : null}
        farmNotice={initialTab === "farm" ? notice : null}
        farmLocationOptions={farmLocationOptions}
        piggyPlayerId={piggyPlayerId ?? ""}
        initialTab={initialTab}
      />
    </PageShell>
  );
}
