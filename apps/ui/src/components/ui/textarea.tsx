import * as React from "react"
import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content input-state min-h-textarea w-full rounded-md border-(length:--border-width) border-input bg-transparent px-3 py-2 type-body transition-[color,box-shadow] outline-none focus-visible:focus-ring placeholder:text-secondary disabled:cursor-not-allowed aria-invalid:border-error md:text-(length:--text-label-size) md:leading-(--text-label-leading) dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
