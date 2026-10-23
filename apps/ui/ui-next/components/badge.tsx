// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/licenses/shadcn-preview-02.md.
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@ui-next/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-3xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:focus-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-error aria-invalid:ring-error/20 dark:aria-invalid:ring-error/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-accent-bg text-on-accent [a]:hover:bg-accent-bg/80",
        secondary:
          "bg-muted text-primary [a]:hover:bg-muted/80",
        destructive:
          "bg-error-muted text-error focus-visible:focus-ring dark:bg-error-muted dark:focus-visible:focus-ring [a]:hover:bg-error-muted",
        outline:
          "border-border text-primary [a]:hover:bg-muted [a]:hover:text-secondary",
        ghost:
          "hover:bg-muted hover:text-secondary dark:hover:bg-muted/50",
        link: "text-accent underline-offset-4 hover:underline",
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
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
