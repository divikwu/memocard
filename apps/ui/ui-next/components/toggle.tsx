// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/licenses/shadcn-preview-02.md.
"use client"

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cva, type VariantProps } from "class-variance-authority"
import { cnState } from "@ui-next/lib/utils"

const toggleVariants = cva(
  "group/toggle inline-flex items-center justify-center gap-1 rounded-3xl text-sm font-medium whitespace-nowrap transition-colors outline-none hover:bg-muted hover:text-primary focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-error/20 aria-pressed:bg-muted dark:aria-invalid:ring-error/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "border border-border-strong bg-transparent hover:bg-muted",
      },
      size: {
        default:
          "h-element-md min-w-element-md px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        sm: "h-element-sm min-w-element-sm px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-element-lg min-w-element-lg px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive
      data-slot="toggle"
      className={cnState(className, toggleVariants({ variant, size }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
