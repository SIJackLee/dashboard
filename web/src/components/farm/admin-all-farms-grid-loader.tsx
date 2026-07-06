import { AdminAllFarmsGridPanels } from "@/components/farm/admin-all-farms-grid-panels";
import { AdminHubPanelsHydrator } from "@/components/farm/admin-hub-panels-hydrator";
import { loadAdminAllFarmsGridPanels } from "@/lib/farm/load-admin-all-farms-grid";
import type { FarmKey } from "@/lib/data/farm-key";

type Props = {
  farmOptions: FarmKey[];
};

export async function AdminAllFarmsGridLoader({ farmOptions }: Props) {
  const panels = await loadAdminAllFarmsGridPanels(farmOptions);
  return (
    <AdminHubPanelsHydrator panels={panels}>
      <AdminAllFarmsGridPanels panels={panels} />
    </AdminHubPanelsHydrator>
  );
}