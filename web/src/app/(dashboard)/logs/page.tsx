import { redirect } from "next/navigation";
import { isSettingsTabVisible } from "@/lib/dashboard-sections";

export default function LogsPage() {
  if (isSettingsTabVisible("replay")) {
    redirect("/settings?tab=replay");
  }
  redirect("/settings?tab=dashboard");
}
