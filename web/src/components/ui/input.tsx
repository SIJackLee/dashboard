import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { dashboardControl } from "@/lib/ui/dashboard-page-ui"
import { cn } from "@/lib/utils"

type InputProps = Omit<React.ComponentProps<"input">, "size"> & {
  uiSize?: "default" | "dashboard"
}

function Input({ className, type, uiSize = "default", ...props }: InputProps) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-ui-size={uiSize}
      className={cn(
        "w-full min-w-0 rounded-lg border border-input bg-transparent transition-colors outline-none file:inline-flex file:border-0 file:bg-transparent file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        uiSize === "default" &&
          "h-8 px-2.5 py-1 text-base file:h-6 file:text-sm md:text-sm",
        uiSize === "dashboard" && dashboardControl.input,
        className
      )}
      {...props}
    />
  )
}

export { Input }
