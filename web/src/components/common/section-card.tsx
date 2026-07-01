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

  size = "lg",

  children,

}: SectionCardProps) {

  const lg = size === "lg";

  return (

    <Card
      className={cn(
        lg &&
          "rounded-xl max-md:text-base max-md:leading-snug md:text-[1.75rem] md:leading-snug",
        className
      )}
    >

      {(title || action) && (

        <CardHeader

          className={cn(

            "flex flex-row items-start justify-between gap-3 space-y-0 max-md:flex-col max-md:items-stretch",

            lg && dashboardUi.cardHeaderLg

          )}

        >

          <div className="min-w-0 flex-1">

            {title && (

              <CardTitle

                className={
                  lg
                    ? "text-base font-semibold leading-tight md:text-lg lg:text-[2rem]"
                    : "text-base"
                }

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
            <div className="flex shrink-0 flex-wrap items-center gap-2 max-md:w-full max-md:justify-end">
              {action}
            </div>
          ) : null}

        </CardHeader>

      )}

      <CardContent
        className={cn(
          lg && dashboardUi.cardContentLg,
          contentClassName
        )}
      >

        {children}

      </CardContent>

    </Card>

  );

}


