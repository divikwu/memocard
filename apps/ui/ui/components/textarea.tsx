// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/themes/ui-luma.sources.json.
import * as React from "react"
import { cn } from "../lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-none rounded-textarea border border-transparent bg-control px-3 py-3 text-base transition-[color,box-shadow,background-color] outline-none placeholder:text-control-secondary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-control-error-border aria-invalid:ring-3 aria-invalid:ring-control-error-ring md:text-sm focus-visible:focus-ring",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
