import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/page-shell";
import { PiggyGame } from "@/components/piggy/piggy-game";
import { PIGGY_PLAY_ENABLED } from "@/lib/feature-flags";
import { getPiggyPlayerId } from "@/lib/data/piggy-settings";

export default async function PlayPage() {
  if (!PIGGY_PLAY_ENABLED) {
    redirect("/farm");
  }

  const playerId = await getPiggyPlayerId();

  return (
    <PageShell title="오락" wide>
      <PiggyGame
        playerId={playerId ?? undefined}
        fixedPlayer={Boolean(playerId)}
        requireSettingsId={!playerId}
        settingsUrl="/settings?tab=dashboard"
      />
    </PageShell>
  );
}
