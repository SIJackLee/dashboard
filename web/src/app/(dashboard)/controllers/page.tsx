import { PageShell } from "@/components/layout/page-shell";
import { ControllersView } from "@/components/controllers/controllers-view";
import { getCurrentUser, canCommand } from "@/lib/auth/get-current-user";
import { getThermoCommandHistory } from "@/lib/data/commands";
import { getBarnReadings } from "@/lib/data/iot";

export default async function ControllersPage({
  searchParams,
}: {
  searchParams: Promise<{ farm?: string; module?: string; ctrl?: string }>;
}) {
  const { farm, module, ctrl } = await searchParams;
  const [readings, history, user] = await Promise.all([
    getBarnReadings(),
    getThermoCommandHistory(20),
    getCurrentUser(),
  ]);

  return (
    <PageShell title="컨트롤러 제어">
      <ControllersView
        readings={readings}
        initialFarm={farm}
        initialModule={module}
        initialCtrl={ctrl}
        canCommand={canCommand(user)}
        commands={history}
      />
    </PageShell>
  );
}
