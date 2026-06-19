import { redirect } from "next/navigation";
import { adminOpsHref } from "@/lib/admin/ops-tabs";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { parseFarmKeyFromQuery } from "@/lib/data/farm-key";
import {
  devicesAlarmSettingsHref,
  devicesDisplayPanelHref,
  devicesFarmPanelHref,
} from "@/lib/monitoring/devices-panel";

/** 레거시 /settings — 신규 위치로 redirect */
export default async function SettingsLegacyRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    lsind?: string;
    item?: string;
    ok?: string;
    error?: string;
    filter?: string;
  }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  const isAdmin = Boolean(user?.isAdmin);
  const farmKey = parseFarmKeyFromQuery(params.lsind, params.item) ?? undefined;
  const passthrough = {
    lsind: params.lsind,
    item: params.item,
    ok: params.ok,
    error: params.error,
    filter: params.filter,
  };

  switch (params.tab) {
    case "alarm":
      redirect(devicesAlarmSettingsHref(passthrough));
    case "farm":
      redirect(
        isAdmin
          ? adminOpsHref("farms")
          : devicesFarmPanelHref(farmKey, passthrough)
      );
    case "dashboard":
      redirect(
        isAdmin
          ? adminOpsHref("display")
          : devicesDisplayPanelHref(passthrough)
      );
    default:
      redirect(isAdmin ? adminOpsHref("display") : "/farm");
  }
}
