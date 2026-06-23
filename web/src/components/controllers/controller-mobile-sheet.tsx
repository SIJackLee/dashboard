"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  title: string;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

export function ControllerMobileSheet({
  open,
  title,
  onOpenChange,
  children,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex h-[min(92dvh,920px)] w-full flex-col gap-0 overflow-hidden rounded-t-2xl p-0 lg:hidden"
      >
        <SheetHeader className="shrink-0 border-b px-4 py-3 pr-12">
          <SheetTitle className={cn(dashboardTypography.sectionTitle)}>
            {title}
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-safe pt-3">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
