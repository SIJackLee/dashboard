import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MasterDetailLayoutProps = {
  master: ReactNode;
  detail?: ReactNode;
  showDetail?: boolean;
  /** Tailwind col-span for master on xl+ (default 2/3) */
  masterClassName?: string;
};

/** controllers · alarms 공통 — 좌 목록 / 우 상세 */
export function MasterDetailLayout({
  master,
  detail,
  showDetail = true,
  masterClassName = "xl:col-span-2",
}: MasterDetailLayoutProps) {
  const split = showDetail && detail != null;

  return (
    <div className={cn("grid grid-cols-1 gap-6", split && "xl:grid-cols-3")}>
      <div className={cn("space-y-6", split && masterClassName)}>{master}</div>
      {split ? detail : null}
    </div>
  );
}
