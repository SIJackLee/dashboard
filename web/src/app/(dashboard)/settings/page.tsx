import { PageShell } from "@/components/layout/page-shell";
import { SettingsView } from "@/components/settings/settings-view";
import { getBarnMetas } from "@/lib/data/barn-meta";
import { getControllerMetas } from "@/lib/data/controller-meta";
import { buildStallCatalog, getLiveReadings } from "@/lib/data/iot";
import { getLiveSummary } from "@/lib/data/iot-live";
import type { SettingsTabId } from "@/components/settings/settings-tab-nav";

const barnNotices: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "저장했습니다." },
  invalid: { tone: "error", text: "입력값이 올바르지 않습니다." },
  save: { tone: "error", text: "저장에 실패했습니다. 권한을 확인하세요." },
};

const validTabs = new Set<SettingsTabId>([
  "dashboard",
  "farm",
  "barn",
  "controller",
  "alarm",
  "log",
]);

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ok?: string; error?: string }>;
}) {
  const { tab, ok, error } = await searchParams;
  const [barnMetas, readings, liveSummary, controllerMetas] = await Promise.all([
    getBarnMetas(),
    getLiveReadings(),
    getLiveSummary(),
    getControllerMetas(),
  ]);
  const stallCatalog = buildStallCatalog(readings);
  const initialTab =
    tab && validTabs.has(tab as SettingsTabId) ? (tab as SettingsTabId) : "dashboard";
  const notice = ok
    ? barnNotices[ok]
    : error
      ? barnNotices[error]
      : null;

  return (
    <PageShell title="설정">
      <SettingsView
        barnMetas={barnMetas}
        stallCatalog={stallCatalog}
        readings={readings}
        liveSummary={liveSummary}
        controllerMetas={controllerMetas}
        barnNotice={initialTab === "barn" ? notice : null}
        controllerNotice={initialTab === "controller" ? notice : null}
        initialTab={initialTab}
      />
    </PageShell>
  );
}
