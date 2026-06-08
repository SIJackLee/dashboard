import {
  LayoutDashboard,
  Tractor,
  Warehouse,
  Cpu,
  Bell,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { label: "대시보드", href: "/dashboard", icon: LayoutDashboard },
  { label: "농장", href: "/farm", icon: Tractor },
  { label: "축사", href: "/barns", icon: Warehouse },
  { label: "컨트롤러", href: "/controllers", icon: Cpu },
  { label: "알람", href: "/alarms", icon: Bell },
  { label: "로그", href: "/logs", icon: ScrollText },
  { label: "설정", href: "/settings", icon: Settings },
];
