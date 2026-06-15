import { PageShell } from "@/components/layout/page-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { filterReadingsByFarmKey, resolveActiveFarmKey } from "@/lib/auth/farm-access";
import { getCurrentUser } from "@/lib/auth/get-current-user";
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
  forbidden: {
    tone: "error",
    text: "이 항목을 수정할 권한이 없습니다. 명령 권한 또는 관리자 역할이 필요합니다.",
  },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ok?: string; error?: string; lsind?: string; item?: string }>;
}) {
  const params = await searchParams;
  const { tab, ok, error, lsind, item } = params;

  const [readings, alarmSettings, displaySettings, piggyPlayerId, farmLocationOptions, user] =
    await Promise.all([
      getLiveReadings(),
      getAlarmSettings(),
      getDisplaySettings(),
      getPiggyPlayerId(),
      getEditableFarmLocationOptions(),
      getCurrentUser(),
    ]);

  const activeFarmKey = user ? resolveActiveFarmKey(user, params) : null;
  const scopedReadings = filterReadingsByFarmKey(readings, activeFarmKey);
  const stallCatalog = buildStallCatalog(scopedReadings);
  const initialTab = resolveSettingsTab(tab);
  const notice = ok ? notices[ok] : error ? notices[error] : null;

  return (
    <PageShell title="설정" searchParams={{ lsind, item }}>
      <SettingsView
        stallCatalog={stallCatalog}
        readings={scopedReadings}
        alarmSettings={alarmSettings}
        displaySettings={displaySettings}
        notice={notice}
        farmLocationOptions={farmLocationOptions}
        piggyPlayerId={piggyPlayerId ?? ""}
        initialTab={initialTab}
      />
    </PageShell>
  );
}
