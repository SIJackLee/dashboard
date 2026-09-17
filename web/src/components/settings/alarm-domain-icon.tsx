import { Bell, Droplets, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlarmDomain = "temp" | "humidity";

/** 알람 행·차트 기준 — Bell + 도메인(온도계/물방울). */
export function AlarmDomainIcon({
  domain,
  className,
  sizeClass = "size-4",
  tone = "channel",
}: {
  domain: AlarmDomain;
  className?: string;
  sizeClass?: string;
  /** inherit = 부모 버튼 색. channel = 온도/습도 토큰 */
  tone?: "channel" | "inherit";
}) {
  const Metric = domain === "temp" ? Thermometer : Droplets;
  const inherit = tone === "inherit";
  const metricColor = inherit
    ? undefined
    : domain === "temp"
      ? "text-channel-temp"
      : "text-channel-hum";

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-hidden
    >
      <Bell className={cn(sizeClass, inherit ? undefined : "text-foreground")} />
      <Metric className={cn(sizeClass, metricColor)} />
    </span>
  );
}
