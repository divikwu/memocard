// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/licenses/shadcn-preview-02.md.
import * as React from "react"
import { cn } from "@ui-next/lib/utils"

import { IconPlaceholder } from "@ui-next/showcase-icons"

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default"
}

function NativeSelect({
  className,
  size = "default",
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className="h-element-md w-full min-w-0 appearance-none rounded-3xl border border-transparent bg-control py-1 pr-8 pl-3 text-sm transition-[color,box-shadow,background-color] outline-none select-none selection:bg-accent-bg selection:text-on-accent placeholder:text-control-secondary focus-visible:focus-ring disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-error aria-invalid:ring-3 aria-invalid:ring-error/20 data-[size=sm]:h-element-sm dark:aria-invalid:border-error/50 dark:aria-invalid:ring-error/40"
        {...props}
      />
      <IconPlaceholder
        lucide="ChevronDownIcon"
        tabler="IconSelector"
        hugeicons="UnfoldMoreIcon"
        phosphor="CaretDownIcon"
        remixicon="RiArrowDownSLine"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-control-secondary select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
