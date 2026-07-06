"use client";

import { useEffect, type ReactNode } from "react";
import { useAdminHubPanels } from "@/lib/navigation/admin-hub-panels-context";
import type { AdminFarmGridPanel } from "@/lib/farm/admin-all-farms-grid-shared";

type Props = {
  panels: AdminFarmGridPanel[];
  children: ReactNode;
};

/** 서버 loader 결과 → AdminHubPanelsContext warm */
export function AdminHubPanelsHydrator({ panels, children }: Props) {
  const { setPanels } = useAdminHubPanels();

  useEffect(() => {
    setPanels(panels);
  }, [panels, setPanels]);

  return <>{children}</>;
}
