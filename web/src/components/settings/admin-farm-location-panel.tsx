"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  saveFarmLocationInlineAction,
  saveFarmLocationsBatchInlineAction,
} from "@/app/(dashboard)/settings/actions";
import { PageActionButton } from "@/components/common/page-action-button";
import { SectionCard } from "@/components/common/section-card";
import { FarmLocationEditFields } from "@/components/settings/farm-location-edit-fields";
import {
  buildBulkRowsFromOptions,
  dirtyBulkInputs,
  FarmLocationBulkTable,
  type BulkRowState,
} from "@/components/settings/farm-location-bulk-table";
import type { FarmLocationMapMarker } from "@/components/settings/farm-location-mini-map";
import { farmKeyId, type FarmKey } from "@/lib/data/farm-key";
import type { EditableFarmOption } from "@/lib/data/farm-location";
import {
  exportFarmLocationTemplateCsv,
  exportFarmLocationsCsv,
  mergeCsvRowsWithOptions,
  parseFarmLocationsCsv,
} from "@/lib/data/farm-location-csv";
import {
  draftFromOption,
  farmOptionId,
  filterFarmOptions,
  findOptionById,
  nextUnconfiguredOption,
  summarizeFarmLocations,
  type FarmLocationFilter,
  type LocationDraft,
} from "@/lib/settings/farm-location-client";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const FarmLocationMiniMap = dynamic(
  () =>
    import("@/components/settings/farm-location-mini-map").then(
      (m) => m.FarmLocationMiniMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-xl border bg-muted/10">
        <p className={cn("text-muted-foreground", dashboardUi.body)}>지도 로딩…</p>
      </div>
    ),
  }
);

type ViewMode = "split" | "table";

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

function parseFarmKeyFromSearch(
  searchParams: ReturnType<typeof useSearchParams>
): string | null {
  const lsind = searchParams.get("lsind")?.trim();
  const item = searchParams.get("item")?.trim();
  if (!lsind || !item) return null;
  return `${lsind}/${item}`;
}

export function AdminFarmLocationPanel({ options, initialFarmKey }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const summary = useMemo(() => summarizeFarmLocations(options), [options]);

  const initialId = useMemo(() => {
    if (initialFarmKey) {
      const id = farmKeyId(initialFarmKey);
      if (findOptionById(options, id)) return id;
    }
    const fromUrl = parseFarmKeyFromSearch(searchParams);
    if (fromUrl && findOptionById(options, fromUrl)) return fromUrl;
    return options[0] ? farmOptionId(options[0].farmKey) : "";
  }, [initialFarmKey, options, searchParams]);

  const [selectedId, setSelectedId] = useState(initialId);
  const [draft, setDraft] = useState<LocationDraft>(() =>
    draftFromOption(findOptionById(options, initialId))
  );
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<FarmLocationFilter>("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );
  const [bulkRows, setBulkRows] = useState<Record<string, BulkRowState>>(() =>
    buildBulkRowsFromOptions(options)
  );
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => filterFarmOptions(options, filter, query, null),
    [options, filter, query]
  );

  const selected = findOptionById(options, selectedId);

  const mapMarkers = useMemo((): FarmLocationMapMarker[] => {
    return options
      .filter((o) => o.location)
      .map((o) => ({
        farmKey: o.farmKey,
        label: o.label,
        lat: o.location!.lat,
        lng: o.location!.lng,
      }));
  }, [options]);

  const syncUrl = useCallback(
    (farmKey: FarmKey) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", "farm");
      params.set("lsind", farmKey.lsindRegistNo);
      params.set("item", farmKey.itemCode);
      router.replace(`/settings?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const selectFarm = useCallback(
    (id: string, opt?: EditableFarmOption) => {
      const hit = opt ?? findOptionById(options, id);
      if (!hit) return;
      setSelectedId(id);
      setDraft(draftFromOption(hit));
      syncUrl(hit.farmKey);
    },
    [options, syncUrl]
  );

  useEffect(() => {
    setBulkRows(buildBulkRowsFromOptions(options));
  }, [options]);

  useEffect(() => {
    if (searchParams.get("filter") === "unconfigured") {
      setFilter("unconfigured");
    }
  }, [searchParams]);

  const handleSaveSingle = () => {
    if (!selected || !draft.sido || !draft.sigungu) {
      setMessage({ tone: "error", text: "시·도와 시·군·구를 선택하세요." });
      return;
    }
    startTransition(async () => {
      const result = await saveFarmLocationInlineAction({
        farmKey: selected.farmKey,
        sido: draft.sido,
        sigungu: draft.sigungu,
        addressDetail: draft.addressDetail || undefined,
      });
      if (result.ok) {
        setMessage({ tone: "ok", text: `${selected.label} 위치를 저장했습니다.` });
        router.refresh();
      } else {
        setMessage({
          tone: "error",
          text: result.error ?? "저장에 실패했습니다.",
        });
      }
    });
  };

  const handleNextUnconfigured = () => {
    const next = nextUnconfiguredOption(options, selectedId);
    if (!next) {
      setMessage({ tone: "ok", text: "미설정 농장이 없습니다." });
      return;
    }
    selectFarm(farmOptionId(next.farmKey), next);
  };

  const handleSaveBulk = () => {
    const inputs = dirtyBulkInputs(options, bulkRows);
    if (inputs.length === 0) return;
    startTransition(async () => {
      const result = await saveFarmLocationsBatchInlineAction(inputs);
      if (result.saved > 0) {
        setMessage({
          tone: result.failed.length ? "error" : "ok",
          text:
            result.failed.length > 0
              ? `${result.saved}건 저장, ${result.failed.length}건 실패`
              : `${result.saved}건을 저장했습니다.`,
        });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: "저장에 실패했습니다." });
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
          <PageActionButton
            type="button"
            variant={viewMode === "split" ? "primary" : "outline"}
            onClick={() => setViewMode("split")}
          >
            목록+편집
          </PageActionButton>
          <PageActionButton
            type="button"
            variant={viewMode === "table" ? "primary" : "outline"}
            onClick={() => setViewMode("table")}
          >
            테이블 일괄
          </PageActionButton>
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

      {viewMode === "table" ? (
        <SectionCard title="농장 위치 일괄 편집">
          <FarmLocationBulkTable
            options={options}
            rows={bulkRows}
            onRowsChange={setBulkRows}
            selectedIds={selectedBulkIds}
            onSelectedIdsChange={setSelectedBulkIds}
            onSaveDirty={handleSaveBulk}
            pending={pending}
          />
        </SectionCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(240px,320px)_1fr]">
          <SectionCard title="농장 목록" className="xl:max-h-[42rem] xl:overflow-y-auto">
            <div className="mb-3 space-y-2">
              <input
                className="w-full rounded-lg border bg-background px-3 py-2"
                placeholder="농장 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
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
                      "rounded-lg border px-3 py-1",
                      dashboardUi.body,
                      filter === id
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
                        : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="space-y-1">
              {filtered.map((o) => {
                const id = farmOptionId(o.farmKey);
                const active = id === selectedId;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => selectFarm(id, o)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                        dashboardUi.body,
                        active
                          ? "border-emerald-500 bg-emerald-50"
                          : "hover:bg-muted/60"
                      )}
                    >
                      <span className="font-medium">{o.label}</span>
                      <span className="mt-0.5 block text-muted-foreground">
                        {o.location
                          ? `${o.location.sido} ${o.location.sigungu}`
                          : "위치 미설정"}
                        {!o.hasLiveData ? " · LIVE 없음" : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          <div className="space-y-4">
            <FarmLocationMiniMap
              markers={mapMarkers}
              selectedId={selectedId}
              onSelect={(fk) => selectFarm(farmOptionId(fk))}
            />

            <SectionCard
              title={selected?.label ?? "농장 선택"}
              description="시·도·시·군·구를 선택하면 전국 농장 지도에 반영됩니다."
              action={
                <div className="flex flex-wrap gap-2">
                  <PageActionButton
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={handleNextUnconfigured}
                  >
                    다음 미설정
                  </PageActionButton>
                  <PageActionButton
                    type="button"
                    variant="primary"
                    disabled={pending || !selected}
                    onClick={handleSaveSingle}
                  >
                    {pending ? "저장 중…" : "저장"}
                  </PageActionButton>
                </div>
              }
            >
              {selected ? (
                <>
                  <FarmLocationEditFields draft={draft} onChange={setDraft} disabled={pending} />
                  {selected.location ? (
                    <p className={cn("mt-4 text-muted-foreground", dashboardUi.tableMeta)}>
                      현재: {selected.location.addressText} ·{" "}
                      {selected.location.lat.toFixed(4)}, {selected.location.lng.toFixed(4)}
                      {selected.location.updatedAt ? (
                        <> · 수정 {new Date(selected.location.updatedAt).toLocaleString("ko-KR")}</>
                      ) : null}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className={dashboardUi.body}>왼쪽 목록에서 농장을 선택하세요.</p>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
