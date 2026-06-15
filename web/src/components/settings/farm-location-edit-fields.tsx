"use client";

import { useMemo } from "react";
import { regionsBySido, SIDO_LIST } from "@/lib/geo/korea-regions";
import type { LocationDraft } from "@/lib/settings/farm-location-client";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  draft: LocationDraft;
  onChange: (next: LocationDraft) => void;
  disabled?: boolean;
};

export function FarmLocationEditFields({
  draft,
  onChange,
  disabled = false,
}: Props) {
  const bySido = useMemo(() => regionsBySido(), []);
  const sigunguOptions = useMemo(
    () => bySido.get(draft.sido) ?? [],
    [bySido, draft.sido]
  );

  const handleSidoChange = (next: string) => {
    const first = bySido.get(next)?.[0];
    onChange({
      ...draft,
      sido: next,
      sigungu: first?.sigungu ?? "",
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2">
        <span className={cn("font-medium", dashboardUi.body)}>시·도</span>
        <select
          className="w-full rounded-lg border bg-background px-3 py-2"
          value={draft.sido}
          disabled={disabled}
          onChange={(e) => handleSidoChange(e.target.value)}
        >
          {SIDO_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2">
        <span className={cn("font-medium", dashboardUi.body)}>시·군·구</span>
        <select
          className="w-full rounded-lg border bg-background px-3 py-2"
          value={draft.sigungu}
          disabled={disabled || !draft.sido}
          onChange={(e) => onChange({ ...draft, sigungu: e.target.value })}
        >
          {sigunguOptions.map((r) => (
            <option key={r.sigungu} value={r.sigungu}>
              {r.sigungu}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-2 sm:col-span-2">
        <span className={cn("font-medium", dashboardUi.body)}>상세 주소 (선택)</span>
        <input
          type="text"
          className="w-full rounded-lg border bg-background px-3 py-2"
          placeholder="읍·면·리 또는 도로명"
          value={draft.addressDetail}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...draft, addressDetail: e.target.value })
          }
        />
      </label>
    </div>
  );
}
