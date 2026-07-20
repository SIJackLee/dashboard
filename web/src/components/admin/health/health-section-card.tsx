import { SectionCard } from "@/components/common/section-card";
import { opsTypography } from "@/lib/ui/dashboard-page-ui";
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
      headerInline={hub}
      className={cn(hub && "min-h-0", className)}
      contentClassName={cn(hub && "pt-0", contentClassName)}
      titleClassName={hub ? opsTypography.sectionTitle : undefined}
    >
      {hub && description ? (
        <p className={cn("mb-2", opsTypography.sectionDesc)}>{description}</p>
      ) : null}
      {children}
    </SectionCard>
  );
}