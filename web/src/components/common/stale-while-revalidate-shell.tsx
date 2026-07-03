import { cn } from "@/lib/utils";

type Props = {
  stale?: boolean;
  children: React.ReactNode;
  className?: string;
};

/** revalidate 중 기존 UI 유지 + 살짝 dim (SWR 시각 피드백) */
export function StaleWhileRevalidateShell({
  stale = false,
  children,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "relative transition-opacity duration-200",
        stale && "opacity-[0.72]",
        className,
      )}
      aria-busy={stale || undefined}
    >
      {children}
      {stale ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-emerald-500/15"
          aria-hidden
        />
      ) : null}
    </div>
  );
}
