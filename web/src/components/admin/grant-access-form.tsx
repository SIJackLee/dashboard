"use client";

import { UserPlus } from "lucide-react";
import { grantFarmAccess } from "@/app/(dashboard)/admin/users/actions";
import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
        className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-end"
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="farm_uid">농장 UID</Label>
          <Input
            id="farm_uid"
            name="farm_uid"
            type="number"
            min={0}
            defaultValue={1}
            required
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <Checkbox name="can_command" />
          명령 권한
        </label>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <UserPlus className="size-4" />
          부여
        </button>
      </form>
    </SectionCard>
  );
}
