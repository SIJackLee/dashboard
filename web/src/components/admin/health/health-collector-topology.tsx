import Link from "next/link";
import type { CollectorNodeState } from "@/lib/admin/health/types";
import {
  HealthStatusBadge,
  healthStatusBorderClass,
} from "@/components/admin/health/health-status-badge";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type HealthCollectorTopologyProps = {
  nodes?: CollectorNodeState[];
};

function strokeForStatus(status: CollectorNodeState["status"]): string {
  switch (status) {
    case "ok":
      return "text-emerald-500";
    case "warn":
      return "text-amber-500";
    case "critical":
      return "text-red-500";
    case "unknown":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground/50";
  }
}

export function HealthCollectorTopology({ nodes }: HealthCollectorTopologyProps) {
  const mqtt = nodes?.find((n) => n.id === "collector-mqtt");
  const rs = nodes?.find((n) => n.id === "collector-rs");
  const cNode = nodes?.find((n) => n.id === "collector-c");

  const mqttStroke = strokeForStatus(mqtt?.status ?? "ok");
  const rsStroke = strokeForStatus(rs?.status ?? "ok");
  const cStroke = strokeForStatus(cNode?.status ?? "unknown");

  return (
    <div className="space-y-2">
      <p className={dashboardTypography.meta}>
        실선 = COL uplink rollup (MQTT→RS→DB) · 점선 = downlink (C, rollup 제외)
      </p>
      <svg viewBox="0 0 440 118" className="h-auto w-full max-w-lg" aria-hidden>
        <rect
          x={4}
          y={8}
          width={268}
          height={52}
          rx={8}
          fill="none"
          className="stroke-sky-500/60"
          strokeWidth={1}
          strokeDasharray="6 3"
        />
        <text x={12} y={22} className="fill-sky-600 text-[9px] dark:fill-sky-400">
          COL rollup
        </text>
        <line x1={70} y1={44} x2={130} y2={44} className="stroke-border" strokeWidth={2} />
        <line x1={190} y1={44} x2={250} y2={44} className="stroke-border" strokeWidth={2} />
        <rect
          x={10}
          y={28}
          width={60}
          height={32}
          rx={6}
          fill="none"
          className={mqttStroke}
          strokeWidth={2}
        />
        <text x={40} y={48} textAnchor="middle" className="fill-foreground text-[9px]">
          MQTT
        </text>
        <rect
          x={130}
          y={28}
          width={60}
          height={32}
          rx={6}
          fill="none"
          className={rsStroke}
          strokeWidth={2}
        />
        <text x={160} y={48} textAnchor="middle" className="fill-foreground text-[9px]">
          RS
        </text>
        <rect
          x={250}
          y={28}
          width={60}
          height={32}
          rx={6}
          fill="none"
          className="text-emerald-500"
          strokeWidth={2}
        />
        <text x={280} y={48} textAnchor="middle" className="fill-foreground text-[9px]">
          DB
        </text>
        <line x1={160} y1={60} x2={160} y2={78} className="stroke-border" strokeDasharray="3 2" />
        <rect
          x={88}
          y={82}
          width={72}
          height={28}
          rx={6}
          fill="none"
          className={cStroke}
          strokeWidth={2}
          strokeDasharray="4 2"
        />
        <text x={124} y={100} textAnchor="middle" className="fill-muted-foreground text-[8px]">
          C cmd
        </text>
        <text x={124} y={112} textAnchor="middle" className="fill-muted-foreground/70 text-[7px]">
          별도 노드
        </text>
        <rect
          x={330}
          y={30}
          width={72}
          height={28}
          rx={6}
          fill="none"
          className="text-muted-foreground/50"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        <text x={366} y={48} textAnchor="middle" className="fill-muted-foreground/60 text-[8px]">
          EXT(off)
        </text>
      </svg>
    </div>
  );
}

type CollectorSubGridProps = {
  nodes: CollectorNodeState[];
};

const ROLLUP_IDS = new Set(["collector-mqtt", "collector-rs"]);

export function CollectorSubGrid({ nodes }: CollectorSubGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {nodes.map((node) => (
        <Link
          key={node.id}
          href={`/admin/health/${node.id}`}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border-2 bg-card p-3 hover:bg-muted/40",
            healthStatusBorderClass(node.status),
            !ROLLUP_IDS.has(node.id) && "border-dashed"
          )}
        >
          <span className="text-xl font-semibold">{node.short}</span>
          <span className="text-center text-lg text-muted-foreground">{node.label}</span>
          <HealthStatusBadge status={node.status} />
          {!ROLLUP_IDS.has(node.id) && node.status !== "not_implemented" ? (
            <span className="text-center text-xs text-muted-foreground">rollup 제외</span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
