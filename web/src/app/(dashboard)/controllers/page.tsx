import { PageShell } from "@/components/layout/page-shell";
import { CascadeSelector } from "@/components/controllers/cascade-selector";
import { ControllerDetailPanel } from "@/components/controllers/controller-detail-panel";
import { ControllerListPanel } from "@/components/controllers/controller-list-panel";
import { CommandPanel } from "@/components/controllers/command-panel";
import { CommandHistoryTable } from "@/components/controllers/command-history-table";

export default function ControllersPage() {
  return (
    <PageShell title="컨트롤러 제어">
      <CascadeSelector />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ControllerDetailPanel />
        <ControllerListPanel />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CommandPanel />
        <CommandHistoryTable />
      </div>
    </PageShell>
  );
}
