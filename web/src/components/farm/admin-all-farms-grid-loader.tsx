import { AdminAllFarmsGridPanels } from "@/components/farm/admin-all-farms-grid-panels";
import { AdminHubGridTailLoader } from "@/components/farm/admin-hub-grid-tail-loader";
import { AdminHubPanelsHydrator } from "@/components/farm/admin-hub-panels-hydrator";
import { ADMIN_HUB_MAX_FARMS } from "@/lib/data/admin-hub-live";
import type { FarmKey } from "@/lib/data/farm-key";

type Props = {
  farmOptions: FarmKey[];
};

/**
 * Hub 그리드는 SSR에서 LIVE를 치지 않고, TailLoader가 전부 hydrate (cold TTFB).
 * overview·farmOptions만 서버에서 채운 뒤 그리드는 클라이언트로 넘긴다.
 *
 * TailLoader는 hubClientNav 전환 전(children)에도 마운트되어야 한다.
 * 빈 panels만 seed하면 ready=false라 hub 분기 TailLoader에 도달하지 못한다.
 */
export function AdminAllFarmsGridLoader({ farmOptions }: Props) {
  const keys = farmOptions.slice(0, ADMIN_HUB_MAX_FARMS);

  return (
    <AdminHubPanelsHydrator panels={[]} tailFarmKeys={keys}>
      <AdminAllFarmsGridPanels
        panels={[]}
        liveFromContext
        consideredFarmCount={keys.length}
      />
      <AdminHubGridTailLoader />
    </AdminHubPanelsHydrator>
  );
}
