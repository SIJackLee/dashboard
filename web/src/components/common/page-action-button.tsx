import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dashboardControl } from "@/lib/ui/dashboard-page-ui";

type PageActionButtonProps = {
  children?: ReactNode;
  icon?: ReactNode;
  variant?: "outline" | "primary" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  "aria-label"?: string;
  "aria-busy"?: boolean;
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
  "aria-label": ariaLabel,
  "aria-busy": ariaBusy,
}: PageActionButtonProps) {
  const iconOnly = children == null || children === false;
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={ariaBusy}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border font-medium transition-colors disabled:cursor-wait disabled:opacity-50",
        iconOnly ? "size-8 min-w-8 shrink-0 p-0 md:size-11 md:min-w-11" : "gap-2",
        !iconOnly && dashboardControl.buttonOutline,
        iconOnly && "border",
        variant === "outline" && "hover:bg-muted",
        variant === "primary" &&
          "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700",
        variant === "danger" &&
          "border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300",
        className
      )}
    >
      {icon}
      {iconOnly ? null : children}
    </button>
  );
}
