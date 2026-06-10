import { PageShell } from "@/components/layout/page-shell";
import { ControllersView } from "@/components/controllers/controllers-view";
import { getCurrentUser, canCommand } from "@/lib/auth/get-current-user";
import { getThermoCommandHistory } from "@/lib/data/commands";
import { getLiveReadings } from "@/lib/data/iot";
import { getReplayControllers } from "@/lib/data/iot-replay";

export default async function ControllersPage({
  searchParams,
}: {
  searchParams: Promise<{
    lsind?: string;
    item?: string;
    module?: string;
    ctrl?: string;
  }>;
}) {
  const { lsind, item, module, ctrl } = await searchParams;
  const [readings, replayHistory, history, user] = await Promise.all([
    getLiveReadings(),
    getReplayControllers({ limit: 500 }),
    getThermoCommandHistory(20),
    getCurrentUser(),
  ]);

  return (
    <PageShell title="컨트롤러 제어">
      <ControllersView
        readings={readings}
        replayHistory={replayHistory}
        initialLsind={lsind}
        initialItem={item}
        initialModule={module}
        initialCtrl={ctrl}
        canCommand={canCommand(user)}
        commands={history}
      />
    </PageShell>
  );
}
