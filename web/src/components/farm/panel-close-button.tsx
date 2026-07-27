import { X } from "lucide-react";
import { motionClass } from "@/lib/ui/motion-classes";
import { cn } from "@/lib/utils";

type Props = {
  onClick: () => void;
  className?: string;
  size?: "sm" | "md";
};

/** 히트맵·상세 패널 닫기 — X 아이콘 */
export function PanelCloseButton({ onClick, className, size = "md" }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="닫기"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted hover:text-foreground",
        motionClass.microInteractive,
        size === "sm" ? "size-7" : "size-8",
        className,
      )}
    >
      <X className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
    </button>
  );
}
