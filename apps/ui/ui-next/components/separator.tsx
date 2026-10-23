// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/licenses/shadcn-preview-02.md.
"use client"

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "@ui-next/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props) {
  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={(state) => cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        typeof className === "function" ? className(state) : className
      )}
      {...props}
    />
  )
}

export { Separator }
