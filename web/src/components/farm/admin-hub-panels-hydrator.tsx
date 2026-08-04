"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
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

/** 서버 loader 결과 → AdminHubPanelsContext warm (paint 전 seed).
 *  panels=[] 로 매 렌더 seed 하면 progressive hydrate가 지워지므로 1회만 seed.
 */
export function AdminHubPanelsHydrator({
  panels,
  tailFarmKeys = [],
  hubFarmKeys = [],
  children,
}: Props) {
  const { setPanels, setTailFarmKeys, setHubFarmKeys } = useAdminHubPanels();
  const seededRef = useRef(false);

  useLayoutEffect(() => {
    if (!seededRef.current) {
      seededRef.current = true;
      if (panels.length > 0) setPanels(panels);
      setTailFarmKeys(tailFarmKeys);
      setHubFarmKeys(hubFarmKeys.length > 0 ? hubFarmKeys : tailFarmKeys);
      return;
    }
    // 이후에는 실데이터 panels만 반영 — 빈 배열로 wipe 금지
    if (panels.length > 0) setPanels(panels);
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
