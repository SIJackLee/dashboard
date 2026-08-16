import type { ComponentType } from "react";
import {
  Cpu,
  Database,
  Inbox,
  Monitor,
  Radio,
  Send,
  Share2,
  Warehouse,
  Workflow,
} from "lucide-react";

type IconCmp = ComponentType<{ className?: string }>;

const ICONS: Record<string, IconCmp> = {
  field: Warehouse,
  "field-module": Warehouse,
  "field-controller": Cpu,
  mqtt: Radio,
  "collector-mqtt": Radio,
  rs: Inbox,
  collector: Inbox,
  "collector-rs": Inbox,
  "c-cmd": Send,
  "collector-c": Send,
  decode: Workflow,
  db: Database,
  storage: Database,
  ui: Monitor,
  dashboard: Monitor,
  "ext-link": Share2,
  external: Share2,
  "collector-ekape": Share2,
  "collector-ftp": Share2,
};

export function resolveHealthPipelineIcon(id: string): IconCmp {
  if (id.startsWith("mod-")) return Warehouse;
  return ICONS[id] ?? Radio;
}

export function HealthPipelineIcon({
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const key = id.startsWith("mod-") ? "field" : id;
  const Icon = ICONS[key] ?? Radio;
  return <Icon className={className} aria-hidden />;
}
