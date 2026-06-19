import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { PiggyGame } from "@/components/piggy/piggy-game";
import { PiggyPlayerIdForm } from "@/components/settings/piggy-player-id-form";
import { PIGGY_PLAY_ENABLED } from "@/lib/feature-flags";
import { getPiggyPlayerId } from "@/lib/data/piggy-settings";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const notices: Record<string, { tone: "ok" | "error"; text: string }> = {
  saved: { tone: "ok", text: "저장했습니다." },
  invalid: { tone: "error", text: "입력값이 올바르지 않습니다." },
  save: { tone: "error", text: "저장에 실패했습니다. 권한을 확인하세요." },
};

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  if (!PIGGY_PLAY_ENABLED) {
    redirect("/farm");
  }

  const params = await searchParams;
  const playerId = await getPiggyPlayerId();
  const notice = params.ok
    ? notices[params.ok]
    : params.error
      ? notices[params.error]
      : null;

  return (
    <PageShell wide>
      <div className="space-y-6">
        {!playerId ? <PiggyPlayerIdForm initialPlayerId="" /> : null}
        {notice ? (
          <p
            className={cn(
              "rounded-xl border px-5 py-4",
              dashboardUi.body,
              notice.tone === "ok"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            )}
          >
            {notice.text}
          </p>
        ) : null}
        <PiggyGame
          playerId={playerId ?? undefined}
          fixedPlayer={Boolean(playerId)}
          requireSettingsId={!playerId}
          settingsUrl="/play"
        />
      </div>
    </PageShell>
  );
}
