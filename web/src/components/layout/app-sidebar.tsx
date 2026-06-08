"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-background">
      {/* 브랜드 */}
      <div className="flex h-16 items-center gap-2 px-5">
        <div className="flex size-8 items-center justify-center rounded-md bg-emerald-600 text-white">
          <Leaf className="size-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">스마트 축사</p>
          <p className="text-xs text-muted-foreground">IoT</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 계정 */}
      <div className="border-t p-3">
        <button className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-muted">
          <span className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium">
              관
            </span>
            관리자
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}
