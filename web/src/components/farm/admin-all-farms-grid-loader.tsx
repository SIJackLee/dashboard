import { AdminAllFarmsGridPanels } from "@/components/farm/admin-all-farms-grid-panels";
import { AdminHubPanelsHydrator } from "@/components/farm/admin-hub-panels-hydrator";
import { ADMIN_HUB_MAX_FARMS } from "@/lib/data/admin-hub-live";
import { ADMIN_HUB_GRID_BATCH_SIZE } from "@/lib/farm/admin-all-farms-grid-shared";
import { loadAdminFarmGridPanelsForKeys } from "@/lib/farm/load-admin-all-farms-grid";
import type { FarmKey } from "@/lib/data/farm-key";

type Props = {
  farmOptions: FarmKey[];
};

/** 첫 배치만 SSR — 나머지 farm은 context TailLoader가 hydrate (M4 TTFB). */
export async function AdminAllFarmsGridLoader({ farmOptions }: Props) {
  const keys = farmOptions.slice(0, ADMIN_HUB_MAX_FARMS);
  const firstKeys = keys.slice(0, ADMIN_HUB_GRID_BATCH_SIZE);
  const restKeys = keys.slice(ADMIN_HUB_GRID_BATCH_SIZE);
  const panels = await loadAdminFarmGridPanelsForKeys(firstKeys);

  return (
    <AdminHubPanelsHydrator panels={panels} tailFarmKeys={restKeys}>
      <AdminAllFarmsGridPanels
        panels={panels}
        liveFromContext
        consideredFarmCount={keys.length}
      />
    </AdminHubPanelsHydrator>
  );
}
