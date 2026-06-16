"use client"

import * as React from "react"

import { dashboardTypography } from "@/lib/ui/dashboard-page-ui"
import { cn } from "@/lib/utils"

function Label({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"label"> & {
  size?: "default" | "dashboard"
}) {
  return (
    <label
      data-slot="label"
      data-size={size}
      className={cn(
        "flex select-none items-center gap-2 font-medium group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        size === "default" && "text-sm leading-none",
        size === "dashboard" && dashboardTypography.formLabel,
        className
      )}
      {...props}
    />
  )
}

export { Label }
