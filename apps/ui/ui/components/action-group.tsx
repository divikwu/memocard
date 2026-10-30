import type * as React from "react"
import { createContext, useContext } from "react"
import { cn } from "../lib/utils"
import "./action-group.css"

const MobileActionGroupContext = createContext(false)

function MobileActionGroupProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <MobileActionGroupContext.Provider value={enabled}>{children}</MobileActionGroupContext.Provider>
}

function useMobileActionGroup() {
  return useContext(MobileActionGroupContext)
}

function ActionGroup({ className, size = "default", ...props }: React.ComponentProps<"div"> & { size?: "default" | "lg" }) {
  const mobile = useMobileActionGroup()
  return (
    <div
      data-slot="action-group"
      data-size={size}
      data-mobile-actions={mobile || undefined}
      role="group"
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-0 rounded-full bg-surface p-0.5 shadow-control [&_button]:shadow-none",
        size === "lg" ? "h-12 [&_button]:size-11 [&_button]:min-h-11 [&_button]:min-w-11" : "h-10 [&_button]:size-element-md [&_button]:min-h-element-md [&_button]:min-w-element-md",
        className
      )}
      {...props}
    />
  )
}

export { ActionGroup, MobileActionGroupProvider, useMobileActionGroup }
