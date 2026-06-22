import { SectionCard } from "@/components/common/section-card";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /** hub: 모니터링 허브용 compact 카드 */
  density?: "default" | "hub";
  className?: string;
  contentClassName?: string;
};

/** Admin health — dashboard SectionCard */
export function HealthSectionCard({
  title,
  description,
  children,
  action,
  density = "default",
  className,
  contentClassName,
}: Props) {
  const hub = density === "hub";
  return (
    <SectionCard
      title={title}
      description={hub ? undefined : description}
      action={action}
      size={hub ? "default" : "lg"}
      className={cn(hub && "min-h-0", className)}
      contentClassName={cn(hub && "pt-0", contentClassName)}
    >
      {hub && description ? (
        <p className="mb-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {children}
    </SectionCard>
  );
}