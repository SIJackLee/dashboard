import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

type PageActionButtonProps = {
  children: ReactNode;
  icon?: ReactNode;
  variant?: "outline" | "primary" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
};

/** 페이지 본문 텍스트 스케일에 맞춘 액션 버튼 (새로고침·초기화·조회 등) */
export function PageActionButton({
  children,
  icon,
  variant = "outline",
  type = "button",
  disabled,
  onClick,
  className,
}: PageActionButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border font-medium transition-colors disabled:opacity-50",
        dashboardUi.btnSmAction,
        variant === "outline" && "hover:bg-muted",
        variant === "primary" &&
          "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
        variant === "danger" &&
          "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300",
        className
      )}
    >
      {icon}
      {children}
    </button>
  );
}
