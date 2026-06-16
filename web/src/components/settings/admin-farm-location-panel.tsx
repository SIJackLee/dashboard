"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  saveFarmLocationInlineAction,
  saveFarmLocationsBatchInlineAction,
} from "@/app/(dashboard)/settings/actions";
import { PageActionButton } from "@/components/common/page-action-button";
import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import {
  buildBulkRowsFromOptions,
  FarmLocationBulkTable,
  type BulkRowState,
} from "@/components/settings/farm-location-bulk-table";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import {
  exportFarmLocationTemplateCsv,
  exportFarmLocationsCsv,
  mergeCsvRowsWithOptions,
  parseFarmLocationsCsv,
} from "@/lib/data/farm-location-csv";
import type { FarmKey } from "@/lib/data/farm-key";
import {
  farmOptionId,
  filterFarmOptions,
  findOptionById,
  summarizeFarmLocations,
  type FarmLocationFilter,
} from "@/lib/settings/farm-location-client";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  options: EditableFarmOption[];
  initialFarmKey?: FarmKey | null;
};

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminFarmLocationPanel({ options }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const summary = useMemo(() => summarizeFarmLocations(options), [options]);

  const [filter, setFilter] = useState<FarmLocationFilter>("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );
  const [bulkRows, setBulkRows] = useState<Record<string, BulkRowState>>(() =>
    buildBulkRowsFromOptions(options)
  );

  const filtered = useMemo(
    () => filterFarmOptions(options, filter, query, null),
    [options, filter, query]
  );

  useEffect(() => {
    setBulkRows(buildBulkRowsFromOptions(options));
  }, [options]);

  useEffect(() => {
    if (searchParams.get("filter") === "unconfigured") {
      setFilter("unconfigured");
    }
  }, [searchParams]);

  const handleApplyRow = (id: string) => {
    const option = findOptionById(options, id);
    const row = bulkRows[id];
    if (!option || !row?.sido || !row?.sigungu) {
      setMessage({ tone: "error", text: "시·도와 시·군·구를 선택하세요." });
      return;
    }

    setApplyingId(id);
    startTransition(async () => {
      const result = await saveFarmLocationInlineAction({
        farmKey: option.farmKey,
        sido: row.sido,
        sigungu: row.sigungu,
        addressDetail: row.addressDetail || undefined,
      });
      setApplyingId(null);
      if (result.ok) {
        setMessage({ tone: "ok", text: `${option.label} 위치를 적용했습니다.` });
        router.refresh();
      } else {
        setMessage({
          tone: "error",
          text: result.error ?? "적용에 실패했습니다.",
        });
      }
    });
  };

  const handleExportConfigured = () => {
    downloadText("farm-locations.csv", exportFarmLocationsCsv(options));
  };

  const handleExportTemplate = () => {
    downloadText("farm-locations-template.csv", exportFarmLocationTemplateCsv(options));
  };

  const handleImportCsv = async (file: File) => {
    const text = await file.text();
    const parsed = parseFarmLocationsCsv(text);
    if (parsed.errors.length > 0) {
      setMessage({ tone: "error", text: parsed.errors.slice(0, 3).join(" · ") });
      return;
    }
    const merged = mergeCsvRowsWithOptions(parsed.rows, options);
    if (merged.errors.length > 0) {
      setMessage({ tone: "error", text: merged.errors.slice(0, 3).join(" · ") });
      return;
    }
    startTransition(async () => {
      const inputs = merged.valid.map((r) => ({
        farmKey: r.farmKey,
        sido: r.sido,
        sigungu: r.sigungu,
        addressDetail: r.addressDetail,
      }));
      const result = await saveFarmLocationsBatchInlineAction(inputs);
      setMessage({
        tone: result.failed.length ? "error" : "ok",
        text: `CSV ${result.saved}건 저장${result.failed.length ? `, ${result.failed.length}건 실패` : ""}`,
      });
      router.refresh();
    });
  };

  if (options.length === 0) {
    return (
      <p className={cn("rounded-xl border bg-muted/30 px-5 py-8", dashboardUi.body)}>
        편집 가능한 농장이 없습니다. LIVE 데이터 또는 farm_location에 농장이
        있어야 합니다.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/15 px-5 py-4",
          dashboardUi.body
        )}
      >
        <div>
          <p className="font-medium">
            농장 {summary.total}곳 · 위치 설정 {summary.configured}/{summary.total}
          </p>
          <p className="mt-1 text-muted-foreground">
            미설정 {summary.unconfigured}곳
            {summary.unconfigured > 0 ? (
              <>
                {" "}
                ·{" "}
                <button
                  type="button"
                  className="text-emerald-700 underline-offset-2 hover:underline"
                  onClick={() => setFilter("unconfigured")}
                >
                  미설정만 보기
                </button>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PageActionButton type="button" variant="outline" onClick={handleExportTemplate}>
            CSV 템플릿
          </PageActionButton>
          <PageActionButton type="button" variant="outline" onClick={handleExportConfigured}>
            CSV 내보내기
          </PageActionButton>
          <PageActionButton
            type="button"
            variant="outline"
            onClick={() => csvInputRef.current?.click()}
          >
            CSV 가져오기
          </PageActionButton>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportCsv(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {message ? (
        <p
          className={cn(
            "rounded-xl border px-5 py-4",
            dashboardUi.body,
            message.tone === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          )}
        >
          {message.text}
        </p>
      ) : null}

      <SectionCard title="농장 위치 설정">
        <div className="mb-4 space-y-3">
          <Input
            uiSize="dashboard"
            className="max-w-xl"
            placeholder="농장 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="농장 검색"
          />
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "전체"],
                ["unconfigured", "미설정"],
                ["configured", "설정됨"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-lg border px-3 py-1.5",
                  dashboardUi.body,
                  filter === id
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {label}
              </button>
            ))}
            <span className={cn("ml-auto text-muted-foreground", dashboardUi.tableMeta)}>
              표시 {filtered.length}/{options.length}곳
            </span>
          </div>
        </div>

        <FarmLocationBulkTable
          options={filtered}
          rows={bulkRows}
          onRowsChange={setBulkRows}
          onApplyRow={handleApplyRow}
          applyingId={applyingId}
          pending={pending}
        />
      </SectionCard>
    </div>
  );
}
