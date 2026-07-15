import { Bell, Droplets, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";

type AlarmDomain = "temp" | "humidity";

/** 알람 행 아이콘 — Bell + 도메인(온도계/물방울). */
export function AlarmDomainIcon({
  domain,
  className,
  sizeClass = "size-4",
}: {
  domain: AlarmDomain;
  className?: string;
  sizeClass?: string;
}) {
  const Metric = domain === "temp" ? Thermometer : Droplets;
  const metricColor =
    domain === "temp" ? "text-orange-600" : "text-sky-600";

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-hidden
    >
      <Bell className={cn(sizeClass, "text-foreground")} />
      <Metric className={cn(sizeClass, metricColor)} />
    </span>
  );
}
