"use client";

import { useMemo, useState, useTransition } from "react";
import { saveFarmLocationAction } from "@/app/(dashboard)/settings/actions";
import { SectionCard } from "@/components/common/section-card";
import { PageActionButton } from "@/components/common/page-action-button";
import { FarmLocationEditFields } from "@/components/settings/farm-location-edit-fields";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import {
  draftFromOption,
  farmOptionId,
  findOptionById,
} from "@/lib/settings/farm-location-client";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  options: EditableFarmOption[];
};

export function FarmLocationForm({ options }: Props) {
  const [selectedId, setSelectedId] = useState(
    () => (options[0] ? farmOptionId(options[0].farmKey) : "")
  );
  const [draft, setDraft] = useState(() => draftFromOption(options[0]));
  const [pending, startTransition] = useTransition();

  const selected = useMemo(
    () => findOptionById(options, selectedId),
    [options, selectedId]
  );

  const handleFarmChange = (id: string) => {
    setSelectedId(id);
    setDraft(draftFromOption(findOptionById(options, id)));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selected) return;
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      void saveFarmLocationAction(formData);
    });
  };

  if (options.length === 0) {
    return (
      <p className={cn("rounded-xl border bg-muted/30 px-5 py-8", dashboardUi.body)}>
        편집 가능한 농장이 없습니다. 농장 위치 수정은 관리자 또는 해당 농장의
        명령 권한이 필요합니다.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="lsind" value={selected?.farmKey.lsindRegistNo ?? ""} />
      <input type="hidden" name="item" value={selected?.farmKey.itemCode ?? ""} />
      <input type="hidden" name="sido" value={draft.sido} />
      <input type="hidden" name="sigungu" value={draft.sigungu} />
      <input type="hidden" name="address_detail" value={draft.addressDetail} />

      <SectionCard
        title="농장 위치"
        description="시·도와 시·군·구를 선택하면 전체 농장 지도에 마커가 표시됩니다. 상세 주소는 선택 사항입니다."
        action={
          <PageActionButton type="submit" variant="primary" disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </PageActionButton>
        }
      >
        <div className="mb-4 space-y-2">
          <span className={cn("font-medium", dashboardUi.body)}>농장</span>
          <select
            className="w-full rounded-lg border bg-background px-3 py-2"
            value={selectedId}
            onChange={(e) => handleFarmChange(e.target.value)}
          >
            {options.map((o) => {
              const id = farmOptionId(o.farmKey);
              return (
                <option key={id} value={id}>
                  {o.label}
                  {o.location ? ` · ${o.location.sido}` : " · 위치 없음"}
                </option>
              );
            })}
          </select>
        </div>

        <FarmLocationEditFields
          draft={draft}
          onChange={setDraft}
          disabled={pending}
        />

        {selected?.location ? (
          <p className={cn("mt-4 text-muted-foreground", dashboardUi.tableMeta)}>
            현재: {selected.location.addressText} ·{" "}
            {selected.location.lat.toFixed(4)}, {selected.location.lng.toFixed(4)}
          </p>
        ) : null}
      </SectionCard>
    </form>
  );
}
