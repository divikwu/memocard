// Sidebar-10 NavActions: official toolbar/menu geometry, MemoCard operations only.
import { useRef } from "react";
import { MoreHorizontal, Plus, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function NavActions({ canCreate, canRefresh, refreshing, onNewNote, onRefresh, onSettings, canDeleteNote=false, onDeleteNote }: {
  canCreate: boolean; canRefresh: boolean; refreshing: boolean;
  canDeleteNote?:boolean; onDeleteNote?:()=>void;
  onNewNote: () => void; onRefresh: () => void; onSettings: () => void;
}) {
  const deleteSelected=useRef(false);
  return <div className="flex items-center gap-2 text-sm">
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="data-[popup-open]:bg-hover" aria-label="页面操作">
        <MoreHorizontal /><span className="sr-only">页面操作</span>
      </Button>} />
      <DropdownMenuContent align="end" className="w-56 rounded-lg p-1" finalFocus={()=>{if(deleteSelected.current){deleteSelected.current=false;onDeleteNote?.();return false;}return true;}}>
        <DropdownMenuGroup>
          <DropdownMenuItem disabled={!canCreate} onClick={onNewNote}><Plus />新建笔记</DropdownMenuItem>
          <DropdownMenuItem disabled={!canRefresh} onClick={onRefresh}><RefreshCw className={refreshing ? "animate-spin motion-reduce:animate-none" : undefined} />刷新笔记库</DropdownMenuItem>
          {onDeleteNote && <DropdownMenuItem disabled={!canDeleteNote} style={{"--accent-foreground":"var(--destructive)"} as React.CSSProperties} onClick={()=>{deleteSelected.current=true;}}><Trash2 style={{color:"inherit"}} />删除笔记</DropdownMenuItem>}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSettings}><Settings2 />设置</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
