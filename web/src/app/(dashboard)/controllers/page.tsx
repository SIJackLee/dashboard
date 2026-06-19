import { redirect } from "next/navigation";
import { setMonitoringTabParam } from "@/lib/monitoring/monitoring-tabs";

export default async function ControllersPage({
  searchParams,
}: {
  searchParams: Promise<{
    lsind?: string;
    item?: string;
    sp?: string;
    stall?: string;
    ctrl?: string;
    module?: string;
  }>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  setMonitoringTabParam(qs, "ops");
  redirect(`/farm?${qs.toString()}`);
}
