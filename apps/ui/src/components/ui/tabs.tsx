"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: (React.ComponentProps<typeof TabsPrimitive.Root> & { className?: string })) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-secondary group-data-[orientation=horizontal]/tabs:h-element-md group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-x-3 gap-y-1 bg-transparent group-data-[orientation=horizontal]/tabs:h-element-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  activateOnFocus = true,
  ...props
}: (React.ComponentProps<typeof TabsPrimitive.List> & { className?: string }) &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      activateOnFocus={activateOnFocus}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: (React.ComponentProps<typeof TabsPrimitive.Tab> & { className?: string })) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border-(length:--border-width) border-transparent px-2 py-1 type-label whitespace-nowrap text-primary/60 transition-[color,background-color,border-color,opacity] group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start hover:text-primary focus-visible:focus-ring disabled:pointer-events-none dark:text-secondary dark:hover:text-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:px-0.5 group-data-[variant=line]/tabs-list:py-0.5 group-data-[variant=line]/tabs-list:data-[active]:bg-transparent dark:group-data-[variant=line]/tabs-list:data-[active]:border-transparent dark:group-data-[variant=line]/tabs-list:data-[active]:bg-transparent",
        "data-[active]:bg-body data-[active]:text-primary dark:data-[active]:border-input dark:data-[active]:bg-input/30 dark:data-[active]:text-primary",
        "after:absolute after:bg-primary after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-[active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: (React.ComponentProps<typeof TabsPrimitive.Panel> & { className?: string })) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
