"use client";

import { useEffect, useMemo, useState } from "react";
import { UserPlus, Users } from "lucide-react";
import { grantBulkFarmAccess } from "@/app/(dashboard)/admin/users/actions";
import { FarmAccessGrantTable } from "@/components/admin/farm-access-grant-table";
import type {
  FarmAccessState,
  GrantFarmOption,
} from "@/components/admin/farm-access-grant-table";
import { ComboSearchBar } from "@/components/common/combo-search-bar";
import { PageActionButton } from "@/components/common/page-action-button";
import { SectionCard } from "@/components/common/section-card";
import type { ManagedUser } from "@/lib/admin/list-users";
import type { FarmKey } from "@/lib/data/farm-key";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

export type { GrantFarmOption } from "@/components/admin/farm-access-grant-table";

type Props = {
  email: string;
  onEmailChange: (email: string) => void;
  farmOptions: GrantFarmOption[];
  users: ManagedUser[];
};

type GrantMode = "bulk" | "single";
type FarmAccessFilter = "all" | "selected" | "unselected";

export function farmValue(fk: FarmKey) {
  return `${fk.lsindRegistNo}/${fk.itemCode}`;
}

function buildUserEmailOptions(users: ManagedUser[]) {
  return users
    .filter((u): u is ManagedUser & { email: string } => !!u.email)
    .map((u) => ({
      value: u.email,
      label: u.displayName ? `${u.displayName} · ${u.email}` : u.email,
    }));
}

function filterGrantFarmOptions(
  options: GrantFarmOption[],
  filter: FarmAccessFilter,
  query: string,
  selectedIds: Set<string>
) {
  const q = query.trim().toLowerCase();
  return options.filter((o) => {
    const id = farmValue(o.farmKey);
    if (filter === "selected" && !selectedIds.has(id)) return false;
    if (filter === "unselected" && selectedIds.has(id)) return false;
    if (q && !o.label.toLowerCase().includes(q) && !id.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}

function FarmSearchControls({
  farmOptions,
  farmQuery,
  onFarmQueryChange,
  farmPickId,
  onFarmPickIdChange,
  filter,
  onFilterChange,
  filteredCount,
  totalCount,
  showBulkActions,
  onSelectAllFiltered,
  onClearFiltered,
}: {
  farmOptions: GrantFarmOption[];
  farmQuery: string;
  onFarmQueryChange: (q: string) => void;
  farmPickId?: string;
  onFarmPickIdChange: (id: string | undefined) => void;
  filter: FarmAccessFilter;
  onFilterChange: (f: FarmAccessFilter) => void;
  filteredCount: number;
  totalCount: number;
  showBulkActions: boolean;
  onSelectAllFiltered: () => void;
  onClearFiltered: () => void;
}) {
  const farmSelectOptions = useMemo(
    () =>
      farmOptions.map((o) => ({
        value: farmValue(o.farmKey),
        label: o.label,
      })),
    [farmOptions]
  );

  return (
    <div className="space-y-3">
      <ComboSearchBar
        label="농장"
        className="max-w-xl"
        options={farmSelectOptions}
        value={farmPickId}
        onValueChange={(v) => {
          onFarmPickIdChange(v);
          const picked = farmOptions.find((o) => farmValue(o.farmKey) === v);
          if (picked) onFarmQueryChange(picked.label);
        }}
        searchQuery={farmQuery}
        onSearchQueryChange={(q) => {
          onFarmQueryChange(q);
          onFarmPickIdChange(undefined);
        }}
        searchPlaceholder="농장 검색…"
      />

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "전체"],
            ["selected", "선택됨"],
            ["unselected", "미선택"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onFilterChange(id)}
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
        {showBulkActions ? (
          <>
            <PageActionButton
              type="button"
              variant="outline"
              onClick={onSelectAllFiltered}
            >
              {farmQuery.trim() || filter !== "all"
                ? "표시 항목 선택"
                : "전체 선택"}
            </PageActionButton>
            <PageActionButton
              type="button"
              variant="outline"
              onClick={onClearFiltered}
            >
              {farmQuery.trim() || filter !== "all"
                ? "표시 항목 해제"
                : "전체 해제"}
            </PageActionButton>
          </>
        ) : null}
        <span
          className={cn("ml-auto text-muted-foreground", dashboardTypography.meta)}
        >
          표시 {filteredCount}/{totalCount}곳
        </span>
      </div>
    </div>
  );
}

export function GrantAccessForm({
  email,
  onEmailChange,
  farmOptions,
  users,
}: Props) {
  const [mode, setMode] = useState<GrantMode>("single");
  const [bulkCanCommand, setBulkCanCommand] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [farmQuery, setFarmQuery] = useState("");
  const [farmPickId, setFarmPickId] = useState<string | undefined>();
  const [filter, setFilter] = useState<FarmAccessFilter>("all");
  const [selectedFarmIds, setSelectedFarmIds] = useState<Set<string>>(
    () => new Set(farmOptions.map((o) => farmValue(o.farmKey)))
  );
  const [accessOverrides, setAccessOverrides] = useState<
    Map<string, FarmAccessState>
  >(() => new Map());

  const selectedUser = useMemo(
    () => users.find((u) => u.email === email),
    [users, email]
  );

  useEffect(() => {
    setAccessOverrides(new Map());
  }, [email]);

  const accessByFarmId = useMemo(() => {
    const map = new Map<string, FarmAccessState>();
    for (const o of farmOptions) {
      const id = farmValue(o.farmKey);
      if (accessOverrides.has(id)) {
        map.set(id, accessOverrides.get(id)!);
        continue;
      }
      const row = selectedUser?.farmAccess.find(
        (a) =>
          a.lsindRegistNo === o.farmKey.lsindRegistNo &&
          a.itemCode === o.farmKey.itemCode
      );
      map.set(id, {
        can_read: row?.can_read ?? false,
        can_command: row?.can_command ?? false,
      });
    }
    return map;
  }, [farmOptions, selectedUser, accessOverrides]);

  const handleAccessChange = (farmId: string, access: FarmAccessState) => {
    setAccessOverrides((prev) => {
      const next = new Map(prev);
      next.set(farmId, access);
      return next;
    });
  };

  const emailOptions = useMemo(() => buildUserEmailOptions(users), [users]);

  const filteredFarmOptions = useMemo(
    () => filterGrantFarmOptions(farmOptions, filter, farmQuery, selectedFarmIds),
    [farmOptions, filter, farmQuery, selectedFarmIds]
  );

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

  const selectedCount = selectedFarmIds.size;
  const totalCount = farmOptions.length;

  const modeToggle = (
    <div className="flex flex-wrap items-center gap-2">
      <PageActionButton
        type="button"
        variant={mode === "single" ? "primary" : "outline"}
        onClick={() => setMode("single")}
      >
        행별 부여
      </PageActionButton>
      <PageActionButton
        type="button"
        variant={mode === "bulk" ? "primary" : "outline"}
        onClick={() => setMode("bulk")}
      >
        <Users className={dashboardUi.iconSm} />
        일괄 부여
      </PageActionButton>
    </div>
  );

  return (
    <SectionCard title="농장 접근 권한 부여" action={modeToggle}>
      {farmOptions.length === 0 ? (
        <p className={cn("text-muted-foreground", dashboardUi.body)}>
          LIVE 데이터에 등록된 농장이 없습니다.
        </p>
      ) : emailOptions.length === 0 ? (
        <p className={cn("text-muted-foreground", dashboardUi.body)}>
          선택 가능한 가입자가 없습니다.
        </p>
      ) : mode === "bulk" ? (
        <form action={grantBulkFarmAccess} className="space-y-4">
          <div className="space-y-3">
            <ComboSearchBar
              label="사용자"
              className="max-w-xl"
              options={emailOptions}
              value={email || undefined}
              onValueChange={(v) => v && onEmailChange(v)}
              searchQuery={userQuery}
              onSearchQueryChange={setUserQuery}
              searchPlaceholder="사용자 검색…"
            />
            <input type="hidden" name="email" value={email} required />

            <FarmSearchControls
              farmOptions={farmOptions}
              farmQuery={farmQuery}
              onFarmQueryChange={setFarmQuery}
              farmPickId={farmPickId}
              onFarmPickIdChange={setFarmPickId}
              filter={filter}
              onFilterChange={setFilter}
              filteredCount={filteredFarmOptions.length}
              totalCount={totalCount}
              showBulkActions
              onSelectAllFiltered={selectAllFiltered}
              onClearFiltered={clearFiltered}
            />
          </div>

          <input
            type="hidden"
            name="can_command"
            value={bulkCanCommand ? "on" : ""}
          />
          <input type="hidden" name="farms_json" value={bulkFarmsJson} />

          <FarmAccessGrantTable
            options={filteredFarmOptions}
            mode="bulk"
            email={email}
            selectedIds={selectedFarmIds}
            onToggle={toggleFarm}
            farmValue={farmValue}
            accessByFarmId={accessByFarmId}
            onAccessChange={handleAccessChange}
          />

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            <PageActionButton
              type="submit"
              variant="outline"
              disabled={selectedCount === 0 || !email.trim()}
              icon={<UserPlus className={dashboardUi.iconSm} />}
              onClick={() => setBulkCanCommand(false)}
            >
              {selectedCount}개 조회권한 부여
            </PageActionButton>
            <PageActionButton
              type="submit"
              variant="primary"
              disabled={selectedCount === 0 || !email.trim()}
              icon={<UserPlus className={dashboardUi.iconSm} />}
              onClick={() => setBulkCanCommand(true)}
            >
              {selectedCount}개 명령권한 부여
            </PageActionButton>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <ComboSearchBar
              label="사용자"
              className="max-w-xl"
              options={emailOptions}
              value={email || undefined}
              onValueChange={(v) => v && onEmailChange(v)}
              searchQuery={userQuery}
              onSearchQueryChange={setUserQuery}
              searchPlaceholder="사용자 검색…"
            />

            <FarmSearchControls
              farmOptions={farmOptions}
              farmQuery={farmQuery}
              onFarmQueryChange={setFarmQuery}
              farmPickId={farmPickId}
              onFarmPickIdChange={setFarmPickId}
              filter={filter}
              onFilterChange={setFilter}
              filteredCount={filteredFarmOptions.length}
              totalCount={totalCount}
              showBulkActions={false}
              onSelectAllFiltered={selectAllFiltered}
              onClearFiltered={clearFiltered}
            />
          </div>

          <FarmAccessGrantTable
            options={filteredFarmOptions}
            mode="single"
            email={email}
            selectedIds={selectedFarmIds}
            onToggle={toggleFarm}
            farmValue={farmValue}
            accessByFarmId={accessByFarmId}
            onAccessChange={handleAccessChange}
          />
        </div>
      )}
    </SectionCard>
  );
}
