// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/themes/ui-luma.sources.json.
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
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border-2 transition-all outline-none group-has-[:focus-visible]/field-label:ring-0 after:absolute after:-inset-x-3 after:-inset-y-2 aria-invalid:border-control-error-border aria-invalid:ring-3 aria-invalid:ring-control-error-ring data-[size=default]:h-5 data-[size=default]:w-11 data-[size=sm]:h-4 data-[size=sm]:w-7 data-checked:border-accent-bg data-checked:bg-accent-bg group-has-[:focus-visible]/field-label:data-checked:border-accent-bg data-unchecked:border-transparent data-unchecked:bg-track group-has-[:focus-visible]/field-label:data-unchecked:border-transparent data-disabled:cursor-not-allowed data-disabled:opacity-50 focus-visible:focus-ring"
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-body shadow-control ring-0 transition-transform group-data-[size=default]/switch:h-4 group-data-[size=default]/switch:w-6 group-data-[size=sm]/switch:h-3 group-data-[size=sm]/switch:w-4 data-checked:translate-x-[calc(100%-8px)] data-checked:bg-switch-checked data-unchecked:translate-x-0 data-unchecked:bg-switch-unchecked"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
