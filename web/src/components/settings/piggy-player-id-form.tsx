"use client";

import { useState, useTransition } from "react";
import { AppNavLink } from "@/components/layout/app-nav-link";
import { SectionCard } from "@/components/common/section-card";
import { PageActionButton } from "@/components/common/page-action-button";
import { savePiggyPlayerIdAction } from "@/app/(dashboard)/settings/actions";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  initialPlayerId: string;
  notice?: { tone: "ok" | "error"; text: string } | null;
};

export function PiggyPlayerIdForm({ initialPlayerId, notice }: Props) {
  const [playerId, setPlayerId] = useState(initialPlayerId);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(() => {
      void savePiggyPlayerIdAction(formData);
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <SectionCard
        title="오락 · 게임 아이디"
        description="Piggy Jump 리더보드에 표시할 닉네임입니다. 2~20자 (영문·숫자·한글·공백/_/-). 저장 후 /play 에 자동 적용됩니다."
        action={
          <PageActionButton type="submit" variant="primary" disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </PageActionButton>
        }
      >
        {notice ? (
          <p
            className={cn(
              "mb-4 rounded-lg border px-4 py-3",
              dashboardUi.body,
              notice.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {notice.text}
          </p>
        ) : null}

        <label className="block space-y-2">
          <span className={cn("font-medium", dashboardUi.body)}>게임 아이디</span>
          <input
            type="text"
            name="player_id"
            className={cn(
              "w-full max-w-md rounded-lg border bg-background px-4 py-2.5",
              dashboardUi.body
            )}
            maxLength={20}
            placeholder="예: piggy_01"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            autoComplete="nickname"
          />
        </label>

        <p className={cn("mt-3 text-muted-foreground", dashboardUi.body)}>
          게임은{" "}
          <AppNavLink
            href="/play"
            message="게임 페이지로 이동 중…"
            className="text-primary underline-offset-2 hover:underline"
          >
            오락
          </AppNavLink>
          메뉴에서 플레이할 수 있습니다.
        </p>
      </SectionCard>
    </form>
  );
}
