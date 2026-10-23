"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

function Popover({
  ...props
}: (React.ComponentProps<typeof PopoverPrimitive.Root> & { className?: string })) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({
  ...props
}: (React.ComponentProps<typeof PopoverPrimitive.Trigger> & { className?: string })) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  side = "bottom",
  alignOffset,
  collisionPadding = 12,
  anchor,
  ...props
}: PopoverPrimitive.Popup.Props & Pick<PopoverPrimitive.Positioner.Props, "anchor" | "side" | "align" | "sideOffset" | "alignOffset" | "collisionPadding"> & { className?: string }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner anchor={anchor} side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} collisionPadding={collisionPadding} className="z-50">
      <PopoverPrimitive.Popup
        data-slot="popover-content"
        className={cn(
          "z-50 w-72 origin-(--transform-origin) motion-popup rounded-md border-(length:--border-width) border-transparent bg-popover shadow-lg p-4 text-on-popover outline-hidden data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
          className
        )}
        {...props}
      />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      className={cn("flex flex-col gap-1 type-label font-normal", className)}
      {...props}
    />
  )
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <div
      data-slot="popover-title"
      className={cn("type-label", className)}
      {...props}
    />
  )
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="popover-description"
      className={cn("text-secondary", className)}
      {...props}
    />
  )
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
}
