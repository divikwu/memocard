// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/themes/ui-luma.sources.json.
"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn, cnState } from "../lib/utils"
import { recoverableLazy } from "./recoverable-lazy"

import { Button } from "./button"
import { ActionGroup, useMobileActionGroup } from "./action-group"
import { HugeiconsIcon } from "@hugeicons/react"
import Cancel01Icon from "@hugeicons/core-free-icons/Cancel01Icon"
import "./sheet.css"
const SheetSwipe = recoverableLazy(() => import("./sheet-swipe"), "滑动关闭")

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetCloseButton({ className, render, children, ...props }: SheetPrimitive.Close.Props) {
  const grouped = useMobileActionGroup()
  const button = <SheetClose aria-label="关闭" {...props} data-action-group={grouped || undefined} className={cnState(className, "ui-sheet-close-button relative shrink-0")} render={render ?? <Button type="button" variant={grouped ? "ghost" : "secondary"} size={grouped ? "icon" : "icon-sm"} />}>
    {children ?? <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} aria-hidden="true" />}
  </SheetClose>
  return grouped ? <ActionGroup>{button}</ActionGroup> : button
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cnState(
        className,
        "fixed inset-0 z-50 bg-overlay transition-opacity duration-fast-max ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm"
      )}
      {...props}
    />
  )
}

function SheetPopup({
  className,
  children,
  side = "right",
  showCloseButton = true,
  swipeToClose = false,
  swipeDisabled = false,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  swipeToClose?: boolean
  swipeDisabled?: boolean
}) {
  const grouped = useMobileActionGroup()
  return (
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cnState(
          className,
          swipeToClose && side === "bottom" && "ui-sheet-swipe",
          grouped && showCloseButton && "[&>[data-slot=sheet-header]]:pr-16",
          "fixed z-50 flex flex-col bg-popover bg-clip-padding text-sm text-primary surface-floating shadow-high transition duration-medium-min ease-standard data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm"
        )}
        {...props}
      >
        {children}
        {swipeToClose && side === "bottom" && <React.Suspense fallback={null}><SheetSwipe disabled={swipeDisabled} /></React.Suspense>}
        {showCloseButton && (
          grouped ? <div className="absolute top-4 right-4"><SheetCloseButton /></div> : <SheetCloseButton className="absolute top-4 right-4" />
        )}
      </SheetPrimitive.Popup>
  )
}

function SheetContent({ forceBackdrop = false, ...props }: React.ComponentProps<typeof SheetPopup> & { forceBackdrop?: boolean }) {
  return <SheetPortal><SheetOverlay forceRender={forceBackdrop} /><SheetPopup {...props} /></SheetPortal>;
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-6", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-6", className)}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cnState(className, "font-heading text-base font-medium text-primary")}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cnState(className, "text-sm text-secondary")}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetCloseButton,
  SheetContent,
  SheetPopup,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
