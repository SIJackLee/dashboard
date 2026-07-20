import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { dashboardTypography, dashboardUi } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  /** true면 모바일에서도 제목·액션 한 줄 유지 */
  headerInline?: boolean;
  /** 기본 레이아웃은 대시보드 스케일(lg). 좁은 임베드만 default */
  size?: "default" | "lg";
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  action,
  className,
  contentClassName,
  titleClassName,
  headerInline = false,
  size = "lg",
  children,
}: SectionCardProps) {
  const lg = size === "lg";
  return (
    <Card
      className={cn(
        lg &&
          "rounded-xl max-md:text-base max-md:leading-snug md:text-[1.75rem] md:leading-snug",
        className,
      )}
    >
      {(title || action) && (
        <CardHeader
          className={cn(
            "flex flex-row items-center justify-between gap-3 space-y-0",
            !headerInline && "max-md:flex-col max-md:items-stretch",
            lg && dashboardUi.cardHeaderLg,
          )}
        >
          <div className="min-w-0 flex-1">
            {title && (
              <CardTitle
                className={cn(
                  lg
                    ? "text-base font-semibold leading-tight md:text-lg lg:text-[2rem]"
                    : "text-base",
                  titleClassName,
                )}
              >
                {title}
              </CardTitle>
            )}
            {description && (
              <p
                className={
                  lg
                    ? cn("mt-1.5", dashboardTypography.cardDesc)
                    : "mt-1 text-sm text-muted-foreground"
                }
              >
                {description}
              </p>
            )}
          </div>
          {action ? (
            <div
              className={cn(
                "flex shrink-0 flex-wrap items-center gap-2",
                !headerInline && "max-md:w-full max-md:justify-end",
              )}
            >
              {action}
            </div>
          ) : null}
        </CardHeader>
      )}
      <CardContent className={cn(lg && dashboardUi.cardContentLg, contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
