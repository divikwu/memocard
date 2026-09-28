// Adapted from shadcn/ui new-york-v4 sidebar (MIT). Source snapshots: docs/ui-reference.
import * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { mergeProps } from "@base-ui/react/merge-props";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SidebarContext = React.createContext<{ open: boolean; toggleSidebar: () => void } | null>(null);
function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("Sidebar requires SidebarProvider");
  return context;
}
function SidebarProvider({ open, onOpenChange, onOpenMobileChange, openMobile, children, className, ...props }: React.ComponentProps<"div"> & {
  open: boolean; onOpenChange: (open: boolean) => void;
  openMobile: boolean; onOpenMobileChange: (open: boolean) => void;
}) {
  const toggleSidebar = React.useCallback(() => {
    if (window.matchMedia("(max-width: 767px)").matches) onOpenMobileChange(!openMobile);
    else onOpenChange(!open);
  }, [open, onOpenChange, openMobile, onOpenMobileChange]);
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Preserve Markdown bold and input shortcuts while editing.
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, [contenteditable=true], [role=dialog]")) return;
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault(); toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);
  return <SidebarContext.Provider value={{ open, toggleSidebar }}>
    <div data-slot="sidebar-wrapper" style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
      className={cn("group/sidebar-wrapper flex min-h-svh w-full", className)} {...props}>{children}</div>
  </SidebarContext.Provider>;
}
function Sidebar({ className, children, rail, ...props }: React.ComponentProps<"aside"> & { rail?: React.ReactNode }) {
  const { open } = useSidebar();
  return <div className="group peer hidden text-sidebar-foreground md:block" data-slot="sidebar" data-state={open ? "expanded" : "collapsed"} data-collapsible={open ? "" : "offcanvas"} data-variant="sidebar" data-side="left">
    <div data-slot="sidebar-gap" className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0" />
    <aside data-slot="sidebar-container"
      className={cn("fixed inset-y-0 left-0 z-10 hidden border-r h-svh w-(--sidebar-width) transition-[left,width] duration-200 ease-linear group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)] md:flex pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]", className)} {...props}>
      <div data-sidebar="sidebar" data-slot="sidebar-inner" aria-hidden={!open} inert={!open} className="flex h-full w-full flex-col bg-sidebar">{children}</div>{rail}
    </aside>
  </div>;
}
function SidebarTrigger({ className, ...props }: React.ComponentProps<typeof Button>) {
  const { open, toggleSidebar } = useSidebar();
  return <Button data-sidebar="trigger" data-slot="sidebar-trigger" variant="ghost" size="icon" className={cn("size-7", className)} aria-label={open ? "收起侧栏" : "展开侧栏"} aria-expanded={open} aria-controls="desktop-sidebar" onClick={toggleSidebar} {...props}><PanelLeft /></Button>;
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="切换侧栏"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="切换侧栏"
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "relative flex w-full flex-1 flex-col bg-background",
        "md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("w-full text-sm", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("flex w-full min-w-0 flex-col gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("group/menu-item relative", className)}
      {...props}
    />
  )
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium text-sidebar-foreground tabular-nums select-none",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-group-label" data-sidebar="group-label" className={cn("flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70", className)} {...props} />;
}

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm ring-sidebar-ring outline-hidden transition-[width,height,padding] group-has-data-[sidebar=menu-action]/menu-item:pr-8 group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_var(--sidebar-border)] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)


function SidebarMenuButton({ render, isActive = false, variant = "default", size = "default", className, ...props }: useRender.ComponentProps<"button"> & { isActive?: boolean } & VariantProps<typeof sidebarMenuButtonVariants>) {
  return useRender({ defaultTagName: "button", render,
    props: mergeProps<"button">({ type: "button", className: cn(sidebarMenuButtonVariants({ variant, size }), "max-md:h-11", className), "aria-current": isActive ? "page" : undefined }, props),
    state: { slot: "sidebar-menu-button", sidebar: "menu-button", size, active: isActive },
  });
}
export { SidebarProvider, Sidebar, SidebarTrigger, SidebarRail, SidebarInset, SidebarHeader, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuBadge };
