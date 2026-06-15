"use client";

import { UserPlus } from "lucide-react";
import { grantFarmAccess } from "@/app/(dashboard)/admin/users/actions";
import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DEFAULT_FARM } from "@/lib/data/farm-key";
import { formatItemCodeLabel } from "@/lib/data/item-code";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  email: string;
  onEmailChange: (email: string) => void;
};

export function GrantAccessForm({ email, onEmailChange }: Props) {
  return (
    <SectionCard
      title="농장 접근 권한 부여"
      description="가입자 이메일로 농장(farm) 단위 조회 권한을 부여합니다."
    >
      <form
        action={grantFarmAccess}
        className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_1fr_auto_auto] sm:items-end"
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
          <Label htmlFor="lsind_regist_no" className={dashboardUi.filterLabel}>
            축산업 등록번호
          </Label>
          <Input
            id="lsind_regist_no"
            name="lsind_regist_no"
            type="text"
            className="h-11 text-xl"
            defaultValue={DEFAULT_FARM.lsindRegistNo}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="item_code" className={dashboardUi.filterLabel}>
            축종 코드 (itemCode) · {formatItemCodeLabel(DEFAULT_FARM.itemCode)}
          </Label>
          <Input
            id="item_code"
            name="item_code"
            type="text"
            className="h-11 text-xl"
            defaultValue={DEFAULT_FARM.itemCode}
            required
          />
        </div>
        <label className={cn("flex items-center gap-3 pb-2", dashboardUi.body)}>
          <Checkbox name="can_command" className="size-5" />
          명령 권한
        </label>
        <button
          type="submit"
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700",
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

