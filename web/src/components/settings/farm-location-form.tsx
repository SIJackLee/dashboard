"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/common/section-card";
import { FarmAddressInput } from "@/components/settings/farm-address-input";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import { farmOptionId, findOptionById } from "@/lib/settings/farm-location-client";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  options: EditableFarmOption[];
  variant?: "page" | "panel";
};

export function FarmLocationForm({ options, variant = "page" }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(
    () => (options[0] ? farmOptionId(options[0].farmKey) : "")
  );

  const selected = useMemo(
    () => findOptionById(options, selectedId),
    [options, selectedId]
  );

  if (options.length === 0) {
    return (
      <p className={cn("rounded-xl border bg-muted/30 px-5 py-8", dashboardUi.body)}>
        편집 가능한 농장이 없습니다. 농장 위치 수정은 관리자 또는 해당 농장의
        명령 권한이 필요합니다.
      </p>
    );
  }

  const isPanel = variant === "panel";

  return (
    <SectionCard
      title="농장 위치"
      description={
        isPanel ? undefined : "농장 주소를 검색하면 지도에 마커가 표시됩니다."
      }
      size={isPanel ? "default" : "lg"}
    >
      <div className="mb-4 space-y-2">
        <span className={cn("font-medium", dashboardUi.body, isPanel && "text-sm")}>
          농장
        </span>
        <select
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {options.map((o) => {
            const id = farmOptionId(o.farmKey);
            return (
              <option key={id} value={id}>
                {o.label}
                {o.location ? ` · ${o.location.addressText}` : " · 위치 없음"}
              </option>
            );
          })}
        </select>
      </div>

      {selected ? (
        <FarmAddressInput
          key={farmOptionId(selected.farmKey)}
          farmKey={selected.farmKey}
          location={selected.location}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </SectionCard>
  );
}
