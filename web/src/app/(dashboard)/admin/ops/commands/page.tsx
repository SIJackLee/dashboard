import { Suspense } from "react";
import { AdminOpsTabShell } from "@/components/admin/admin-ops-tab-shell";
import { CommandHistoryTable } from "@/components/controllers/command-history-table";
import { AdminOpsTabContentSkeleton } from "@/components/admin/admin-ops-loading-skeleton";
import { getThermoCommandHistory } from "@/lib/data/commands";

async function CommandsTabContent() {
  const commands = await getThermoCommandHistory(100);
  return (
    <AdminOpsTabShell>
      <CommandHistoryTable commands={commands} />
    </AdminOpsTabShell>
  );
}

export default function AdminOpsCommandsPage() {
  return (
    <Suspense fallback={<AdminOpsTabContentSkeleton label="명령 이력" />}>
      <CommandsTabContent />
    </Suspense>
  );
}
