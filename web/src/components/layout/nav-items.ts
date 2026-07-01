import { ShieldCheck, Settings, LayoutDashboard, type LucideIcon } from "lucide-react";
import { APP_NAV_SECTIONS } from "@/lib/dashboard-sections";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const NAV_ICONS: Record<string, LucideIcon> = {
  "/farm": LayoutDashboard,
};

/** 사이드바 메뉴 — APP_NAV_SECTIONS */
export const navItems: NavItem[] = APP_NAV_SECTIONS.map((section) => ({
  label: section.label,
  href: section.href,
  icon: NAV_ICONS[section.href] ?? Settings,
}));

/** Admin 전용 — 운영 허브 (시스템 · 사용자 · 농장 메타) */
export const adminNavItems: NavItem[] = [
  { label: "운영", href: "/admin/ops", icon: ShieldCheck },
];
