import { cn } from "@/lib/utils";

type Props = {
  visible: boolean;
  className?: string;
};

/** 영역 상단 얇은 indeterminate progress — router.refresh 등 soft refresh 피드백 */
export function SoftRefreshProgress({ visible, className }: Props) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden rounded-t-xl bg-muted/40",
        className,
      )}
      aria-hidden
    >
      <div className="ui-motion-soft-refresh-bar h-full w-2/3 bg-emerald-500/80" />
    </div>
  );
}
