// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/themes/ui-luma.sources.json.
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cnState } from "../lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 dark:aria-invalid:border-error/50 dark:aria-invalid:ring-error/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:focus-ring",
  {
    variants: {
      variant: {
        default: "bg-accent-bg text-on-accent hover:bg-accent-bg/80",
        outline:
          "border-border bg-body hover:bg-muted hover:text-primary aria-expanded:bg-muted aria-expanded:text-primary dark:bg-transparent dark:hover:bg-neutral/30",
        secondary:
          "bg-control text-primary hover:bg-[color-mix(in_oklch,var(--color-background-control),var(--color-text-primary)_5%)] aria-expanded:bg-control aria-expanded:text-primary",
        ghost:
          "hover:bg-overlay-hover hover:text-primary aria-expanded:bg-muted aria-expanded:text-primary aria-expanded:hover:bg-overlay-hover",
        destructive:
          "bg-error/10 text-error hover:bg-error/20 dark:bg-error/20 dark:hover:bg-error/30 focus-visible:focus-ring",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-element-md gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-element-sm gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        lg: "h-element-lg gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-element-md",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-element-sm",
        "icon-lg": "size-element-lg",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cnState(className, buttonVariants({ variant, size }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
