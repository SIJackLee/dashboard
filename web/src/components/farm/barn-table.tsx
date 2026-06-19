"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { PageActionButton } from "@/components/common/page-action-button";
import { SimpleSelect } from "@/components/common/filter-bar";
import { ReadingHierarchyTable } from "@/components/common/reading-hierarchy-table";
import type { BarnReading } from "@/lib/data/iot";
import { formatStallTypeLabel } from "@/lib/data/stall-type";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { FILTER_ALL, FILTER_ALL_LABEL, isFilterAll } from "@/lib/ui/filter-all";

type Props = {
  rows?: BarnReading[];
  initialSp?: string;
  /** 2xl 스택 하단 목록 — 제목 축소 */
  compactHeader?: boolean;
};

export function BarnTable({ rows = [], initialSp, compactHeader = false }: Props) {
  const router = useRouter();

  const spOptions = useMemo(() => {
    const codes = [
      ...new Set(rows.map((r) => r.stallTyCode).filter(Boolean)),
    ] as string[];
    return [
      { value: FILTER_ALL, label: FILTER_ALL_LABEL },
      ...codes.map((code) => ({
        value: code,
        label: formatStallTypeLabel(code),
      })),
    ];
  }, [rows]);

  const filterSp = initialSp && spOptions.some((o) => o.value === initialSp)
    ? initialSp
    : FILTER_ALL;

  const filteredRows = useMemo(() => {
    if (isFilterAll(filterSp)) return rows;
    return rows.filter((r) => r.stallTyCode === filterSp);
  }, [rows, filterSp]);

  const handleSpChange = (value: string | null) => {
    if (!value || isFilterAll(value)) {
      router.replace("/farm?view=list", { scroll: false });
      return;
    }
    router.replace(`/farm?view=list&sp=${encodeURIComponent(value)}`, {
      scroll: false,
    });
  };

  return (
    <SectionCard
      title={compactHeader ? "축사 목록 (요약)" : "축사 목록"}
      description="축사유형 → 축사 → 컨트롤러 순"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <SimpleSelect
            placeholder={FILTER_ALL_LABEL}
            options={spOptions}
            value={filterSp}
            onValueChange={handleSpChange}
          />
          <PageActionButton
            icon={<RefreshCw className={dashboardUi.iconSm} aria-hidden />}
            onClick={() => router.refresh()}
          >
            새로고침
          </PageActionButton>
        </div>
      }
    >
      <ReadingHierarchyTable
        readings={filteredRows}
        initialExpandedSp={!isFilterAll(filterSp) ? filterSp : undefined}
        linkControllers
      />
    </SectionCard>
  );
}
