"use client";

import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { grantFarmAccess } from "@/app/(dashboard)/admin/users/actions";
import { SectionCard } from "@/components/common/section-card";
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
  const [canCommand, setCanCommand] = useState(false);
  const [farmValueRaw, setFarmValueRaw] = useState(
    () => (farmOptions[0] ? farmValue(farmOptions[0].farmKey) : "")
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

  return (
    <SectionCard
      title="농장 접근 권한 부여"
      description="가입자 이메일로 농장(farm) 단위 조회·명령 권한을 부여합니다."
    >
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

        <button
          type="submit"
          disabled={!selectedFarm}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50",
            dashboardUi.btnDefault
          )}
        >
          <UserPlus className={dashboardUi.iconSm} />
          부여
        </button>
      </form>
    </SectionCard>
  );
}
