"use client";

import { useEffect, type ReactNode } from "react";
import { useAdminHubPanels } from "@/lib/navigation/admin-hub-panels-context";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";
import type { FarmKey } from "@/lib/data/farm-key";

type Props = {
  panels: AdminFarmGridPanel[];
  /** SSR 이후 클라이언트에서 이어서 로드할 farm keys */
  tailFarmKeys?: FarmKey[];
  children: ReactNode;
};

/** 서버 loader 결과 → AdminHubPanelsContext warm */
export function AdminHubPanelsHydrator({
  panels,
  tailFarmKeys = [],
  children,
}: Props) {
  const { setPanels, setTailFarmKeys } = useAdminHubPanels();

  useEffect(() => {
    setPanels(panels);
    setTailFarmKeys(tailFarmKeys);
  }, [panels, tailFarmKeys, setPanels, setTailFarmKeys]);

  return <>{children}</>;
}
