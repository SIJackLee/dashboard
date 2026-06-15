"use client";

import { useMemo, useState, useTransition } from "react";
import { saveFarmLocationAction } from "@/app/(dashboard)/settings/actions";
import { SectionCard } from "@/components/common/section-card";
import { PageActionButton } from "@/components/common/page-action-button";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import { regionsBySido, SIDO_LIST } from "@/lib/geo/korea-regions";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  options: EditableFarmOption[];
};

export function FarmLocationForm({ options }: Props) {
  const [selectedId, setSelectedId] = useState(
    () =>
      options[0]
        ? `${options[0].farmKey.lsindRegistNo}/${options[0].farmKey.itemCode}`
        : ""
  );
  const [sido, setSido] = useState(() => options[0]?.location?.sido ?? SIDO_LIST[0] ?? "");
  const [sigungu, setSigungu] = useState(
    () => options[0]?.location?.sigungu ?? ""
  );
  const [addressDetail, setAddressDetail] = useState(
    () => options[0]?.location?.addressDetail ?? ""
  );
  const [pending, startTransition] = useTransition();

  const bySido = useMemo(() => regionsBySido(), []);
  const sigunguOptions = useMemo(
    () => bySido.get(sido) ?? [],
    [bySido, sido]
  );

  const selected = useMemo(
    () =>
      options.find(
        (o) =>
          `${o.farmKey.lsindRegistNo}/${o.farmKey.itemCode}` === selectedId
      ),
    [options, selectedId]
  );

  const handleFarmChange = (id: string) => {
    setSelectedId(id);
    const opt = options.find(
      (o) => `${o.farmKey.lsindRegistNo}/${o.farmKey.itemCode}` === id
    );
    if (!opt) return;
    if (opt.location) {
      setSido(opt.location.sido);
      setSigungu(opt.location.sigungu);
      setAddressDetail(opt.location.addressDetail ?? "");
    } else {
      const firstSigungu = bySido.get(SIDO_LIST[0] ?? "")?.[0];
      setSido(SIDO_LIST[0] ?? "");
      setSigungu(firstSigungu?.sigungu ?? "");
      setAddressDetail("");
    }
  };

  const handleSidoChange = (next: string) => {
    setSido(next);
    const first = bySido.get(next)?.[0];
    setSigungu(first?.sigungu ?? "");
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
      <input type="hidden" name="sido" value={sido} />
      <input type="hidden" name="sigungu" value={sigungu} />
      <input type="hidden" name="address_detail" value={addressDetail} />

      <SectionCard
        title="농장 위치"
        description="시·도와 시·군·구를 선택하면 전체 농장 지도에 마커가 표시됩니다. 상세 주소는 선택 사항입니다."
        action={
          <PageActionButton type="submit" variant="primary" disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </PageActionButton>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2">
            <span className={cn("font-medium", dashboardUi.body)}>농장</span>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={selectedId}
              onChange={(e) => handleFarmChange(e.target.value)}
            >
              {options.map((o) => {
                const id = `${o.farmKey.lsindRegistNo}/${o.farmKey.itemCode}`;
                return (
                  <option key={id} value={id}>
                    {o.label}
                    {o.location ? ` · ${o.location.sido}` : " · 위치 없음"}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="space-y-2">
            <span className={cn("font-medium", dashboardUi.body)}>시·도</span>
            <select
              className="w-full rounded-lg border bg-background px-3 py-2"
              value={sido}
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
              value={sigungu}
              onChange={(e) => setSigungu(e.target.value)}
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
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
            />
          </label>
        </div>

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
