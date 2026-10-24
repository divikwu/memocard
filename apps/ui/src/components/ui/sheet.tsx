"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
const SheetSwipe = React.lazy(() => import("./sheet-swipe"));

function Sheet({ ...props }: (React.ComponentProps<typeof SheetPrimitive.Root> & { className?: string })) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: (React.ComponentProps<typeof SheetPrimitive.Trigger> & { className?: string })) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: (React.ComponentProps<typeof SheetPrimitive.Close> & { className?: string })) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: (React.ComponentProps<typeof SheetPrimitive.Portal> & { className?: string })) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  style,
  ...props
}: (React.ComponentProps<typeof SheetPrimitive.Backdrop> & { className?: string })) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 motion-popup bg-overlay backdrop-blur-sm data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:animate-in data-[open]:fade-in-0",
        className
      )}
      style={state => ({ animationFillMode: "both", ...(typeof style === "function" ? style(state) : style) })}
      {...props}
    />
  )
}

function SheetContent({
  className,
  style,
  children,
  side = "right",
  showCloseButton = true,
  forceBackdrop = false,
  swipeToClose = false,
  swipeDisabled = false,
  ...props
}: (React.ComponentProps<typeof SheetPrimitive.Popup> & { className?: string }) & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
  forceBackdrop?: boolean
  swipeToClose?: boolean
  swipeDisabled?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay forceRender={forceBackdrop} />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-surface text-on-surface transition duration-(--motion-duration-panel) ease-(--motion-ease-standard) data-[closed]:animate-out data-[open]:animate-in",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l-(length:--border-width) data-[closed]:slide-out-to-right data-[open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r-(length:--border-width) data-[closed]:slide-out-to-left data-[open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b-(length:--border-width) data-[closed]:slide-out-to-top data-[open]:slide-in-from-top",
          side === "bottom" &&
            "inset-x-0 bottom-0 h-auto border-t-(length:--border-width) data-[closed]:slide-out-to-bottom data-[open]:slide-in-from-bottom",
          className
        )}
        style={state => ({ animationFillMode: "both", ...(typeof style === "function" ? style(state) : style) })}
        {...props}
      >
        {children}
        {swipeToClose && side === "bottom" && <React.Suspense fallback={null}><SheetSwipe disabled={swipeDisabled} /></React.Suspense>}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-4 right-4 rounded-xs text-icon-primary opacity-70 transition-opacity hover:opacity-100 focus-visible:focus-ring disabled:pointer-events-none data-[open]:bg-neutral">
            <XIcon className="size-4" />
            <span className="sr-only">关闭</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: (React.ComponentProps<typeof SheetPrimitive.Title> & { className?: string })) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-primary", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: (React.ComponentProps<typeof SheetPrimitive.Description> & { className?: string })) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("type-label font-normal text-secondary", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
