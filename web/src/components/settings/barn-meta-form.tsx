"use client";

import { useState } from "react";
import { Plus, Trash2, Warehouse } from "lucide-react";
import { saveBarnMetasAction } from "@/app/(dashboard)/settings/actions";
import type { BarnMeta } from "@/lib/data/barn-meta";
import { pickNextGridSlot } from "@/lib/data/barn-grid";
import type { StallCatalogEntry } from "@/lib/data/stall-catalog";
import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function catalogKey(e: StallCatalogEntry) {
  return `${e.farmUid}-${e.moduleUid}-${e.stallNo}`;
}

function newBarn(
  index: number,
  existing: BarnMeta[],
  catalog: StallCatalogEntry[]
): BarnMeta {
  const used = new Set(
    existing.map((b) => `${b.farmUid}-${b.moduleUid}-${b.stallNo}`)
  );
  const next = catalog.find((c) => !used.has(catalogKey(c)));
  const stallNo = next?.stallNo ?? "";
  return {
    id: `barn-${Date.now()}-${index}`,
    farmUid: next?.farmUid ?? 1,
    moduleUid: next?.moduleUid ?? 1,
    stallNo,
    name: stallNo ? `${stallNo}축사` : `${index + 1}축사`,
    grid: pickNextGridSlot(existing),
    type: "barn",
  };
}

type Props = {
  initialBarns: BarnMeta[];
  stallCatalog: StallCatalogEntry[];
  notice?: { tone: "ok" | "error"; text: string } | null;
};

export function BarnMetaForm({ initialBarns, stallCatalog, notice }: Props) {
  const [barns, setBarns] = useState<BarnMeta[]>(
    initialBarns.length > 0 ? initialBarns : []
  );

  const update = (id: string, patch: Partial<BarnMeta>) => {
    setBarns((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  const remove = (id: string) => {
    setBarns((prev) => prev.filter((b) => b.id !== id));
  };

  const add = () =>
    setBarns((prev) => [...prev, newBarn(prev.length, prev, stallCatalog)]);

  const applyCatalogEntry = (id: string, key: string) => {
    const entry = stallCatalog.find((c) => catalogKey(c) === key);
    if (!entry) return;
    update(id, {
      farmUid: entry.farmUid,
      moduleUid: entry.moduleUid,
      stallNo: entry.stallNo,
      name: `${entry.stallNo}축사`,
    });
  };

  const catalogOptionsForBarn = (barn: BarnMeta) => {
    const usedByOthers = new Set(
      barns
        .filter((b) => b.id !== barn.id)
        .map((b) => `${b.farmUid}-${b.moduleUid}-${b.stallNo}`)
    );
    return stallCatalog.filter(
      (c) =>
        !usedByOthers.has(catalogKey(c)) ||
        catalogKey(c) === `${barn.farmUid}-${barn.moduleUid}-${barn.stallNo}`
    );
  };

  return (
    <form action={saveBarnMetasAction} className="space-y-4">
      <input type="hidden" name="barns_json" value={JSON.stringify(barns)} readOnly />

      {notice && (
        <p
          className={
            notice.tone === "ok"
              ? "rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
              : "rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {notice.text}
        </p>
      )}

      <SectionCard
        title="축사 설정"
        description="농장(farm) 내 축사(stallNo)를 지정합니다. 축사 하나에 컨트롤러 여러 대가 연결될 수 있으며, 통신모듈당 컨트롤러는 최대 50대(idx 0~49)입니다."
        action={
          <button
            type="button"
            onClick={add}
            className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            <Plus className="size-3.5" />
            축사 추가
          </button>
        }
      >
        {stallCatalog.length === 0 && (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            수집 데이터에 축사번호(stallNo)가 아직 없습니다. 통신모듈이 컨트롤러 데이터와
            함께 stallNo를 전송하면 아래 목록에서 선택할 수 있습니다.
          </p>
        )}

        {barns.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            등록된 축사가 없습니다. &quot;축사 추가&quot;로 농장 지도에 표시할 축사를
            만드세요.
          </p>
        ) : (
          <div className="space-y-6">
            {barns.map((barn) => {
              const options = catalogOptionsForBarn(barn);
              const selectValue =
                options.length > 0 &&
                options.some(
                  (c) =>
                    catalogKey(c) ===
                    `${barn.farmUid}-${barn.moduleUid}-${barn.stallNo}`
                )
                  ? `${barn.farmUid}-${barn.moduleUid}-${barn.stallNo}`
                  : undefined;

              return (
                <div key={barn.id} className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-medium">
                      <Warehouse className="size-4 text-emerald-600" />
                      <span>{barn.name || "(이름 없음)"}</span>
                      {barn.stallNo && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          stallNo {barn.stallNo}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(barn.id)}
                      className="text-muted-foreground hover:text-red-600"
                      title="축사 삭제"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>stallNo (칸번호)</Label>
                      {options.length > 0 ? (
                        <Select
                          value={selectValue}
                          onValueChange={(v) => {
                            if (v) applyCatalogEntry(barn.id, v);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="stallNo 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map((c) => (
                              <SelectItem key={catalogKey(c)} value={catalogKey(c)}>
                                stallNo {c.stallNo}
                                {c.stallTyCode ? ` (${c.stallTyCode})` : ""}
                                {" · "}farm {c.farmUid} / module {c.moduleUid}
                                {c.controllerCount > 1
                                  ? ` · ctrl ${c.controllerCount}`
                                  : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={barn.stallNo}
                          onChange={(e) =>
                            update(barn.id, {
                              stallNo: e.target.value.trim(),
                              name: barn.name || `${e.target.value.trim()}축사`,
                            })
                          }
                          placeholder="03"
                        />
                      )}
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>표시 이름</Label>
                      <Input
                        value={barn.name}
                        onChange={(e) => update(barn.id, { name: e.target.value })}
                        placeholder="3축사"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>농장 UID</Label>
                      <Input
                        type="number"
                        min={0}
                        value={barn.farmUid}
                        onChange={(e) =>
                          update(barn.id, { farmUid: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>모듈 UID</Label>
                      <Input
                        type="number"
                        min={0}
                        value={barn.moduleUid}
                        onChange={(e) =>
                          update(barn.id, { moduleUid: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>유형</Label>
                      <Select
                        value={barn.type ?? "barn"}
                        onValueChange={(v) =>
                          update(barn.id, {
                            type: v === "office" ? "office" : "barn",
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="barn">축사</SelectItem>
                          <SelectItem value="office">관리동</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>지도 열 (1~4)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={4}
                        value={barn.grid.col}
                        onChange={(e) =>
                          update(barn.id, {
                            grid: { ...barn.grid, col: Number(e.target.value) },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>지도 행 (1~4)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={4}
                        value={barn.grid.row}
                        onChange={(e) =>
                          update(barn.id, {
                            grid: { ...barn.grid, row: Number(e.target.value) },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          축사 설정 저장
        </button>
      </div>
    </form>
  );
}
