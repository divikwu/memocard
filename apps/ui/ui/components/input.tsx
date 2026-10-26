// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/themes/ui-luma.sources.json.
import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "../lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-element-md w-full min-w-0 rounded-control border border-transparent bg-control px-3 py-1 text-base transition-[color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-primary placeholder:text-control-secondary disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 md:text-sm dark:aria-invalid:border-error/50 dark:aria-invalid:ring-error/40 focus-visible:focus-ring",
        className
      )}
      {...props}
    />
  )
}

export { Input }
