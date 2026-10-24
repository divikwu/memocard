"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronRightIcon } from "lucide-react"
import { Menu as DropdownMenuPrimitive } from "@base-ui/react/menu";

function DropdownMenu({
  ...props
}: (React.ComponentProps<typeof DropdownMenuPrimitive.Root> & { className?: string })) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: (React.ComponentProps<typeof DropdownMenuPrimitive.Portal> & { className?: string })) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: (React.ComponentProps<typeof DropdownMenuPrimitive.Trigger> & { className?: string })) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  side = "bottom",
  align = "center",
  alignOffset,
  collisionPadding = 12,
  ...props
}: DropdownMenuPrimitive.Popup.Props & Pick<DropdownMenuPrimitive.Positioner.Props, "side" | "align" | "sideOffset" | "alignOffset" | "collisionPadding"> & { className?: string }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Positioner side={side} align={align} sideOffset={sideOffset} alignOffset={alignOffset} collisionPadding={collisionPadding} className="z-50">
      <DropdownMenuPrimitive.Popup
        data-slot="dropdown-menu-content"
        className={cn(
          "z-50 max-h-(--available-height) min-w-[8rem] origin-(--transform-origin) motion-popup overflow-x-hidden overflow-y-auto rounded-md border-(length:--border-width) border-transparent bg-popover p-1 text-on-popover shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
          className
        )}
        {...props}
      />
      </DropdownMenuPrimitive.Positioner>
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: (React.ComponentProps<typeof DropdownMenuPrimitive.Group> & { className?: string })) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: (React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { className?: string }) & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 type-label font-normal outline-hidden select-none focus:bg-overlay-hover focus:text-on-state data-[disabled]:pointer-events-none data-[inset]:pl-8 data-[variant=destructive]:text-error data-[variant=destructive]:focus:text-error [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-[variant=default]:[&_svg:not([class*='text-'])]:text-icon-secondary",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: (React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem> & { className?: string })) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 type-label font-normal outline-hidden select-none focus:bg-overlay-hover focus:text-on-state data-[disabled]:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        <DropdownMenuPrimitive.CheckboxItemIndicator>
          <CheckIcon className="size-4 text-icon-primary" />
        </DropdownMenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: (React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup> & { className?: string })) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: (React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & { className?: string })) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 type-label font-normal outline-hidden select-none hover:bg-overlay-hover data-[highlighted]:bg-overlay-hover focus:bg-overlay-hover focus:text-on-state data-[disabled]:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.RadioItemIndicator>
          <CheckIcon className="size-4 text-icon-primary" />
        </DropdownMenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean
}) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "px-2 py-1.5 type-label data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: (React.ComponentProps<typeof DropdownMenuPrimitive.Separator> & { className?: string })) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("-mx-1 my-1 h-(--border-width) bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto type-supporting tracking-widest text-secondary",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubmenuRoot>) {
  return <DropdownMenuPrimitive.SubmenuRoot {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: (React.ComponentProps<typeof DropdownMenuPrimitive.SubmenuTrigger> & { className?: string }) & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubmenuTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 type-label font-normal outline-hidden select-none focus:bg-overlay-hover focus:text-on-state data-[inset]:pl-8 data-[popup-open]:bg-overlay-hover data-[popup-open]:text-on-state [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-icon-secondary",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </DropdownMenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  sideOffset = 4,
  alignOffset = -4,
  ...props
}: DropdownMenuPrimitive.Popup.Props & Pick<DropdownMenuPrimitive.Positioner.Props, "sideOffset" | "alignOffset"> & { className?: string }) {
  return (
    <DropdownMenuPrimitive.Portal><DropdownMenuPrimitive.Positioner sideOffset={sideOffset} alignOffset={alignOffset} className="z-50"><DropdownMenuPrimitive.Popup
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "z-50 min-w-[8rem] origin-(--transform-origin) motion-popup overflow-hidden rounded-md border-(length:--border-width) border-transparent bg-popover p-1 text-on-popover shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95",
        className
      )}
      {...props}
    /></DropdownMenuPrimitive.Positioner></DropdownMenuPrimitive.Portal>
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
