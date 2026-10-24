"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

function Switch({
  className,
  size = "default",
  ...props
}: (React.ComponentProps<typeof SwitchPrimitive.Root> & { className?: string }) & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch inline-flex shrink-0 items-center rounded-full border-(length:--border-width) border-transparent transition-[color,background-color,border-color,opacity] outline-none focus-visible:focus-ring data-[disabled]:cursor-not-allowed data-[size=default]:h-[1.15rem] data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6 data-[checked]:bg-accent-bg data-[unchecked]:bg-track",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-body ring-0 transition-transform group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 data-[checked]:translate-x-[calc(100%-2px)] data-[unchecked]:translate-x-0 dark:data-[checked]:bg-on-accent dark:data-[unchecked]:bg-primary"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
