// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/licenses/shadcn-preview-02.md.
"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cnState } from "@ui-next/lib/utils"

import { IconPlaceholder } from "@ui-next/showcase-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import MinusSignIcon from "@hugeicons/core-free-icons/MinusSignIcon"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cnState(
        className,
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-sm border border-transparent bg-track transition-shadow outline-none group-has-disabled/field:opacity-50 group-has-[:focus-visible]/field-label:outline-none! group-has-[:focus-visible]/field-label:not-data-checked:border-transparent after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:focus-ring data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 aria-invalid:aria-checked:border-accent-bg dark:aria-invalid:border-error/50 dark:aria-invalid:ring-error/40 data-checked:border-accent-bg data-checked:bg-accent-bg data-checked:text-on-accent data-indeterminate:border-accent-bg data-indeterminate:bg-accent-bg data-indeterminate:text-on-accent group-has-[:focus-visible]/field-label:data-checked:border-accent-bg dark:data-checked:bg-accent-bg"
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            {state.indeterminate ? (
              <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2} aria-hidden="true" />
            ) : (
              <IconPlaceholder
                lucide="CheckIcon"
                tabler="IconCheck"
                hugeicons="Tick02Icon"
                phosphor="CheckIcon"
                remixicon="RiCheckLine"
              />
            )}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
