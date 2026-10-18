import { useState } from "react";
import { AppSidebar, type AppSidebarProps } from "../src/components/app-sidebar";
import { SidebarProvider, SidebarTrigger } from "../src/components/ui/sidebar";
import { TagColorProvider } from "../src/TagColorProvider";

export function SidebarExample(props: AppSidebarProps) {
  const [open, setOpen] = useState(true);
  const [openMobile, setOpenMobile] = useState(true);
  return <TagColorProvider vaultId={props.vaultId}>
    <SidebarProvider open={open} onOpenChange={setOpen} openMobile={openMobile} onOpenMobileChange={setOpenMobile}>
      <AppSidebar {...props} />
      <main className="min-h-dvh flex-1 bg-background p-4 text-foreground">
        <div className="flex items-center gap-2"><SidebarTrigger /><h1 className="text-balance text-lg font-semibold">侧栏组件验收</h1></div>
        <p className="mt-3 max-w-lg text-pretty text-sm text-muted-foreground">使用真实生产组件和示例数据。主题、强调色、圆角可通过顶部工具栏切换；导航操作显示在 Actions。</p>
      </main>
    </SidebarProvider>
  </TagColorProvider>;
}
