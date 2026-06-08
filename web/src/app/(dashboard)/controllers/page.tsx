import { PageShell } from "@/components/layout/page-shell";
import { ControllersView } from "@/components/controllers/controllers-view";
import { CommandPanel } from "@/components/controllers/command-panel";
import { CommandHistoryTable } from "@/components/controllers/command-history-table";
import { getBarnReadings } from "@/lib/data/iot";

export default async function ControllersPage() {
  const readings = await getBarnReadings();

  return (
    <PageShell title="컨트롤러 제어">
      <ControllersView readings={readings} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CommandPanel />
        <CommandHistoryTable />
      </div>
    </PageShell>
  );
}
