import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useRender } from "@base-ui/react/use-render"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md type-label whitespace-nowrap transition-[color,background-color,border-color,opacity,transform,box-shadow] outline-none focus-visible:focus-ring disabled:pointer-events-none aria-invalid:border-error aria-invalid:ring-error/20 dark:aria-invalid:ring-error/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-accent-bg text-on-accent hover:bg-hover-overlay",
        destructive:
          "bg-error text-on-error hover:bg-hover-overlay dark:bg-error/60 ",
        outline:
          "border-(length:--border-width) bg-body aria-pressed:inset-shadow-selected hover:bg-overlay-hover hover:text-on-state dark:border-input dark:bg-input/30 dark:hover:bg-overlay-hover",
        secondary:
          "bg-neutral text-on-neutral hover:bg-hover-overlay",
        ghost:
          "hover:bg-overlay-hover hover:text-on-state",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-element-md px-4 py-2 has-[>svg]:px-3",
        xs: "h-element-xs gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-element-sm gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-element-lg rounded-md px-6 has-[>svg]:px-4",
        icon: "size-md",
        "icon-xs": "size-xs rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-sm",
        "icon-lg": "size-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    render?: useRender.RenderProp
  }) {
  return (
    useRender({
      defaultTagName: "button",
      render,
      props: {
        "data-slot": "button",
        "data-variant": variant,
        "data-size": size,
        "className": cn(buttonVariants({ variant, size, className })),
        ...props,
      },
    })
  )
}

export { Button, buttonVariants }
