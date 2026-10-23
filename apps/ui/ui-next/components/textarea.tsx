// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/themes/ui-next-luma.sources.json.
import * as React from "react"
import { cn } from "../lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-none rounded-2xl border border-transparent bg-control px-3 py-3 text-base transition-[color,box-shadow,background-color] outline-none placeholder:text-control-secondary disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 md:text-sm dark:aria-invalid:border-error/50 dark:aria-invalid:ring-error/40 focus-visible:focus-ring",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
