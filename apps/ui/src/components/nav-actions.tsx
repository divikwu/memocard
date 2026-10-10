// Sidebar-10 NavActions: official toolbar/menu geometry, MemoCard operations only.
import { MoreHorizontal, Plus, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function NavActions({ canCreate, canRefresh, refreshing, onNewNote, onRefresh, onSettings }: {
  canCreate: boolean; canRefresh: boolean; refreshing: boolean;
  onNewNote: () => void; onRefresh: () => void; onSettings: () => void;
}) {
  return <div className="flex items-center gap-2 text-sm">
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7 data-[popup-open]:bg-accent" aria-label="页面操作">
        <MoreHorizontal /><span className="sr-only">页面操作</span>
      </Button>} />
      <DropdownMenuContent align="end" className="w-56 rounded-lg p-1">
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={!canCreate} onClick={onNewNote}><Plus />新建笔记</DropdownMenuItem>
          <DropdownMenuItem disabled={!canRefresh} onClick={onRefresh}><RefreshCw className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined} />刷新笔记库</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSettings}><Settings2 />设置</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
