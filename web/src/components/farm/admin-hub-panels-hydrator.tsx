"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { useAdminHubPanels } from "@/lib/navigation/admin-hub-panels-context";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
import type { FarmKey } from "@/lib/data/farm-key";

type Props = {
  panels: AdminFarmGridPanel[];
  /** SSR 이후 클라이언트에서 이어서 로드할 farm keys */
  tailFarmKeys?: FarmKey[];
  /** placeholder / visible-first 우선순위용 전체 목록 */
  hubFarmKeys?: FarmKey[];
  children: ReactNode;
};

/** 서버 loader 결과 → AdminHubPanelsContext warm (paint 전 seed) */
export function AdminHubPanelsHydrator({
  panels,
  tailFarmKeys = [],
  hubFarmKeys = [],
  children,
}: Props) {
  const { setPanels, setTailFarmKeys, setHubFarmKeys } = useAdminHubPanels();

  useLayoutEffect(() => {
    setPanels(panels);
    setTailFarmKeys(tailFarmKeys);
    setHubFarmKeys(hubFarmKeys.length > 0 ? hubFarmKeys : tailFarmKeys);
  }, [
    panels,
    tailFarmKeys,
    hubFarmKeys,
    setPanels,
    setTailFarmKeys,
    setHubFarmKeys,
  ]);

  return <>{children}</>;
}
