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

  description?: string;

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

    <Card className={cn(lg && "rounded-xl text-[1.75rem] leading-snug", className)}>

      {(title || action) && (

        <CardHeader

          className={cn(

            "flex flex-row items-center justify-between space-y-0",

            lg && dashboardUi.cardHeaderLg

          )}

        >

          <div className="min-w-0">

            {title && (

              <CardTitle

                className={lg ? dashboardTypography.cardTitle : "text-base"}

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

          {action}

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


