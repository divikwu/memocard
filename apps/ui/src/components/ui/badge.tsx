import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useRender } from "@base-ui/react/use-render"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border-(length:--border-width) border-transparent px-2 py-0.5 type-label text-xs whitespace-nowrap transition-[color,box-shadow] focus-visible:focus-ring aria-invalid:border-error aria-invalid:ring-error/20 dark:aria-invalid:ring-error/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-accent-bg text-on-accent [a&]:hover:bg-hover-overlay",
        secondary:
          "bg-neutral text-on-neutral [a&]:hover:bg-hover-overlay",
        destructive:
          "bg-error text-on-error dark:bg-error/60 [a&]:hover:bg-hover-overlay",
        success: "bg-success text-on-success [a&]:hover:bg-hover-overlay",
        warning: "bg-warning text-on-warning [a&]:hover:bg-hover-overlay",
        outline:
          "border-border text-primary [a&]:hover:bg-overlay-hover [a&]:hover:text-on-state",
        ghost: "[a&]:hover:bg-overlay-hover [a&]:hover:text-on-state",
        link: "text-accent underline-offset-4 [a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { render?: useRender.RenderProp }) {
  return (
    useRender({
      defaultTagName: "span",
      render,
      props: {
        "data-slot": "badge",
        "data-variant": variant,
        "className": cn(badgeVariants({ variant }), className),
        ...props,
      },
    })
  )
}

export { Badge, badgeVariants }
