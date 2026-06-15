import {
  Tractor,
  Cpu,
  Bell,
  Settings,
  Gamepad2,
  type LucideIcon,
} from "lucide-react";
import { APP_NAV_SECTIONS } from "@/lib/dashboard-sections";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const NAV_ICONS: Record<string, LucideIcon> = {
  "/farm": Tractor,
  "/controllers": Cpu,
  "/alarms": Bell,
  "/play": Gamepad2,
};

/** 사이드바 메뉴 — APP_NAV_SECTIONS + 설정 */
export const navItems: NavItem[] = [
  ...APP_NAV_SECTIONS.map((section) => ({
    label: section.label,
    href: section.href,
    icon: NAV_ICONS[section.href] ?? Settings,
  })),
  { label: "설정", href: "/settings", icon: Settings },
];
