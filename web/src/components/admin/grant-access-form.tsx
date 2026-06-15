"use client";

import { useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { grantBulkFarmAccess, grantFarmAccess } from "@/app/(dashboard)/admin/users/actions";
import { SectionCard } from "@/components/common/section-card";
import { PageActionButton } from "@/components/common/page-action-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SimpleSelect } from "@/components/common/filter-bar";
import type { FarmKey } from "@/lib/data/farm-key";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type GrantFarmOption = {
  farmKey: FarmKey;
  label: string;
};

type Props = {
  email: string;
  onEmailChange: (email: string) => void;
  farmOptions: GrantFarmOption[];
};

type GrantMode = "single" | "bulk";

function farmValue(fk: FarmKey) {
  return `${fk.lsindRegistNo}/${fk.itemCode}`;
}

function parseFarmValue(raw: string): FarmKey | null {
  const [lsindRegistNo, itemCode] = raw.split("/");
  if (!lsindRegistNo?.trim() || !itemCode?.trim()) return null;
  return { lsindRegistNo: lsindRegistNo.trim(), itemCode: itemCode.trim() };
}

export function GrantAccessForm({
  email,
  onEmailChange,
  farmOptions,
}: Props) {
  const [mode, setMode] = useState<GrantMode>("bulk");
  const [canCommand, setCanCommand] = useState(false);
  const [farmValueRaw, setFarmValueRaw] = useState(
    () => (farmOptions[0] ? farmValue(farmOptions[0].farmKey) : "")
  );
  const [farmQuery, setFarmQuery] = useState("");
  const [selectedFarmIds, setSelectedFarmIds] = useState<Set<string>>(
    () => new Set(farmOptions.map((o) => farmValue(o.farmKey)))
  );

  const selectOptions = useMemo(
    () =>
      farmOptions.map((o) => ({
        value: farmValue(o.farmKey),
        label: o.label,
      })),
    [farmOptions]
  );

  const selectedFarm = parseFarmValue(farmValueRaw);

  const filteredFarmOptions = useMemo(() => {
    const q = farmQuery.trim().toLowerCase();
    if (!q) return farmOptions;
    return farmOptions.filter((o) => {
      const id = farmValue(o.farmKey);
      return o.label.toLowerCase().includes(q) || id.toLowerCase().includes(q);
    });
  }, [farmOptions, farmQuery]);

  const toggleFarm = (id: string, checked: boolean) => {
    setSelectedFarmIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedFarmIds((prev) => {
      const next = new Set(prev);
      for (const o of filteredFarmOptions) {
        next.add(farmValue(o.farmKey));
      }
      return next;
    });
  };

  const clearFiltered = () => {
    setSelectedFarmIds((prev) => {
      const next = new Set(prev);
      for (const o of filteredFarmOptions) {
        next.delete(farmValue(o.farmKey));
      }
      return next;
    });
  };

  const bulkFarmsJson = useMemo(
    () =>
      JSON.stringify(
        farmOptions
          .filter((o) => selectedFarmIds.has(farmValue(o.farmKey)))
          .map((o) => o.farmKey)
      ),
    [farmOptions, selectedFarmIds]
  );

  return (
    <SectionCard
      title="농장 접근 권한 부여"
      description="가입자 이메일로 농장(farm) 단위 조회·명령 권한을 부여합니다."
      action={
        <div className="flex flex-wrap gap-2">
          <PageActionButton
            type="button"
            variant={mode === "bulk" ? "primary" : "outline"}
            onClick={() => setMode("bulk")}
          >
            <Users className={dashboardUi.iconSm} />
            일괄 부여
          </PageActionButton>
          <PageActionButton
            type="button"
            variant={mode === "single" ? "primary" : "outline"}
            onClick={() => setMode("single")}
          >
            단일 부여
          </PageActionButton>
        </div>
      }
    >
      {mode === "bulk" ? (
        <form action={grantBulkFarmAccess} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[2fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="bulk_email" className={dashboardUi.filterLabel}>
                이메일
              </Label>
              <Input
                className="h-11 text-xl"
                id="bulk_email"
                name="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                required
              />
            </div>
            <label className={cn("flex items-center gap-3 pb-2", dashboardUi.body)}>
              <input type="hidden" name="can_command" value={canCommand ? "on" : ""} />
              <Checkbox
                checked={canCommand}
                onCheckedChange={(v) => setCanCommand(v === true)}
                className="size-5"
              />
              명령 권한 포함
            </label>
          </div>

          <input type="hidden" name="farms_json" value={bulkFarmsJson} />

          {farmOptions.length === 0 ? (
            <p className={cn("text-muted-foreground", dashboardUi.body)}>
              LIVE 데이터에 등록된 농장이 없습니다.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className={cn("font-medium", dashboardUi.body)}>
                  농장 선택 · {selectedFarmIds.size}/{farmOptions.length}곳
                </p>
                <div className="flex flex-wrap gap-2">
                  <PageActionButton type="button" variant="outline" onClick={selectAllFiltered}>
                    {farmQuery.trim() ? "검색 결과 전체 선택" : "전체 선택"}
                  </PageActionButton>
                  <PageActionButton type="button" variant="outline" onClick={clearFiltered}>
                    {farmQuery.trim() ? "검색 결과 해제" : "전체 해제"}
                  </PageActionButton>
                </div>
              </div>

              <Input
                value={farmQuery}
                onChange={(e) => setFarmQuery(e.target.value)}
                placeholder="농장 이름·코드 검색"
                className="h-11 max-w-xl text-xl"
                aria-label="농장 검색"
              />

              <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">
                {filteredFarmOptions.length === 0 ? (
                  <p className={cn("px-2 py-4 text-muted-foreground", dashboardUi.body)}>
                    검색 조건에 맞는 농장이 없습니다.
                  </p>
                ) : (
                  filteredFarmOptions.map((o) => {
                    const id = farmValue(o.farmKey);
                    const checked = selectedFarmIds.has(id);
                    return (
                      <label
                        key={id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
                          checked ? "border-emerald-400 bg-emerald-50/70" : "hover:bg-muted/40"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleFarm(id, v === true)}
                        />
                        <span className={dashboardUi.body}>{o.label}</span>
                        <span className={cn("ml-auto text-muted-foreground", dashboardUi.tableMeta)}>
                          {id}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end border-t pt-4">
                <PageActionButton
                  type="submit"
                  variant="primary"
                  disabled={selectedFarmIds.size === 0 || !email.trim()}
                  icon={<UserPlus className={dashboardUi.iconSm} />}
                >
                  {selectedFarmIds.size}개 농장 권한 부여
                </PageActionButton>
              </div>
            </>
          )}
        </form>
      ) : (
        <form
          action={grantFarmAccess}
          className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1.2fr_auto_auto] lg:items-end"
        >
          <div className="space-y-2">
            <Label htmlFor="email" className={dashboardUi.filterLabel}>
              이메일
            </Label>
            <Input
              className="h-11 text-xl"
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="farm_select" className={dashboardUi.filterLabel}>
              농장
            </Label>
            {selectOptions.length > 0 ? (
              <>
                <SimpleSelect
                  value={farmValueRaw}
                  onValueChange={(v) => setFarmValueRaw(v ?? farmValueRaw)}
                  options={selectOptions}
                />
                <input
                  type="hidden"
                  name="lsind_regist_no"
                  value={selectedFarm?.lsindRegistNo ?? ""}
                />
                <input
                  type="hidden"
                  name="item_code"
                  value={selectedFarm?.itemCode ?? ""}
                />
              </>
            ) : (
              <p className={cn("text-muted-foreground", dashboardUi.body)}>
                LIVE 데이터에 등록된 농장이 없습니다.
              </p>
            )}
          </div>

          <label className={cn("flex items-center gap-3 pb-2", dashboardUi.body)}>
            <input type="hidden" name="can_command" value={canCommand ? "on" : ""} />
            <Checkbox
              checked={canCommand}
              onCheckedChange={(v) => setCanCommand(v === true)}
              className="size-5"
            />
            명령 권한
          </label>

          <PageActionButton
            type="submit"
            variant="primary"
            disabled={!selectedFarm}
            icon={<UserPlus className={dashboardUi.iconSm} />}
          >
            부여
          </PageActionButton>
        </form>
      )}
    </SectionCard>
  );
}
