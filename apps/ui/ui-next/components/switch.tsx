// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/themes/ui-next-luma.sources.json.
"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cnState } from "../lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: SwitchPrimitive.Root.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cnState(
        className,
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border-2 transition-all outline-none group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 data-[size=default]:h-5 data-[size=default]:w-11 data-[size=sm]:h-4 data-[size=sm]:w-7 dark:aria-invalid:border-error/50 dark:aria-invalid:ring-error/40 data-checked:border-accent-bg data-checked:bg-accent-bg group-has-[:focus-visible]/field-label:data-checked:border-accent-bg data-unchecked:border-transparent data-unchecked:bg-track group-has-[:focus-visible]/field-label:data-unchecked:border-transparent data-disabled:cursor-not-allowed data-disabled:opacity-50 focus-visible:focus-ring"
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-body shadow-sm ring-0 transition-transform not-dark:bg-clip-padding group-data-[size=default]/switch:h-4 group-data-[size=default]/switch:w-6 group-data-[size=sm]/switch:h-3 group-data-[size=sm]/switch:w-4 data-checked:translate-x-[calc(100%-8px)] dark:data-checked:bg-on-accent data-unchecked:translate-x-0 dark:data-unchecked:bg-primary"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
