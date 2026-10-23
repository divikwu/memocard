import * as React from "react"
import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-element-md input-state w-full min-w-0 rounded-md border-(length:--border-width) border-input bg-transparent px-3 py-1 type-body transition-[color,box-shadow] outline-none focus-visible:focus-ring selection:bg-accent-bg/12 selection:text-primary file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-primary placeholder:text-secondary disabled:pointer-events-none disabled:cursor-not-allowed md:text-(length:--text-label-size) md:leading-(--text-label-leading) dark:bg-input/30",
        "aria-invalid:border-error",
        className
      )}
      {...props}
    />
  )
}

export { Input }
