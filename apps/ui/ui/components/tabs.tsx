// Adapted from shadcn/ui base-luma (MIT); see design/licenses/shadcn-ui.txt and design/themes/ui-luma.sources.json.
"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { cn, cnState } from "../lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cnState(className, "group/tabs flex gap-2 data-horizontal:flex-col")}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-full p-1 text-secondary group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:rounded-2xl data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "h-element-md bg-control p-0.5",
        line: "gap-3 bg-transparent group-data-horizontal/tabs:h-element-md",
        pill: "gap-1 p-0 [&>[data-slot=tabs-trigger]:not([data-active])]:bg-control",
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
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cnState(className, tabsListVariants({ variant }))}
      {...props}
    />
  )
}

const tabsTriggerStyles = cn(
  "relative inline-flex h-element-sm flex-1 items-center justify-center gap-1 rounded-full border border-transparent! px-3 py-1 text-sm font-medium whitespace-nowrap text-tab-muted transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:py-1.5 hover:text-primary disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:focus-ring",
  "group-data-[variant=line]/tabs-list:h-[calc(100%-1px)] group-data-[variant=line]/tabs-list:px-1 group-data-[variant=line]/tabs-list:rounded-element group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:[--color-tab-active:transparent] group-data-[variant=line]/tabs-list:[--color-tab-active-border:transparent]",
  "data-active:bg-tab-active data-active:text-primary data-active:border-tab-active-border aria-pressed:bg-tab-active aria-pressed:text-primary aria-pressed:border-tab-active-border",
  "after:absolute after:bg-primary after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
)

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cnState(className, tabsTriggerStyles)}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cnState(className, "flex-1 text-sm outline-none focus-visible:focus-ring")}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerStyles }
