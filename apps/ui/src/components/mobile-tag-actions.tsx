import { lazy, Suspense, useRef, useState } from "react";
import { ChevronDown, LayoutGrid, List, Pencil, Pin, PinOff } from "lucide-react";
import { useTagPreferences } from "@/hooks/use-tag-preferences";
import { useCollectionLayout } from "@/hooks/use-collection-layout";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import "./app-sidebar.css";

const TagEditor = lazy(() => import("./tag-editor").then(module => ({ default: module.TagEditor })));

export function MobileTagActions({ tag, title, home = false, vaultId, onRename }: { tag?: string | null; title?: string; home?: boolean; vaultId?: string | null; onRename: (from: string, to: string) => Promise<void> }) {
  const { preferences, error, togglePinned, saveAppearance } = useTagPreferences(vaultId);
  const [layout, changeLayout] = useCollectionLayout(home ? "memocard:home-layout" : undefined, home ? "list" : "cards");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const openingEditor = useRef<string | null>(null);
  const titleButton = useRef<HTMLButtonElement>(null);
  const pinned = tag ? preferences.pinned.includes(tag) : false;
  return <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button ref={titleButton} type="button" variant="ghost" size="sm" className="h-8 max-w-full min-w-0 gap-1 px-1 font-medium text-foreground" aria-label={tag ? `标签操作 ${tag}` : `视图选项 ${title}`} aria-current="page" />}><span className="truncate">{tag ? `# ${tag}` : title}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0" /></DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="center" sideOffset={8} className="mobile-tag-dropdown" finalFocus={() => {
        if (openingEditor.current) { setEditing(openingEditor.current); openingEditor.current = null; return false; }
        return titleButton.current;
      }}>
        <DropdownMenuRadioGroup aria-label="笔记布局" value={layout} onValueChange={next => { if (next === "cards" || next === "list") changeLayout(next); }}>
          <DropdownMenuRadioItem value="cards" closeOnClick className="mobile-tag-menu-item"><LayoutGrid aria-hidden="true" />卡片</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="list" closeOnClick className="mobile-tag-menu-item"><List aria-hidden="true" />列表</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {tag && <><DropdownMenuSeparator />
          <DropdownMenuItem closeOnClick={false} className="mobile-tag-menu-item" onClick={() => { if (togglePinned(tag)) setOpen(false); }}>{pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}{pinned ? "取消置顶" : "置顶标签"}</DropdownMenuItem>
          <DropdownMenuItem className="mobile-tag-menu-item" onClick={() => { openingEditor.current = tag; }}><Pencil aria-hidden="true" />编辑名称／图标</DropdownMenuItem>
        </>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
    {editing && titleButton.current && <Suspense fallback={null}><TagEditor path={editing} anchor={titleButton.current} sheet initialIcon={preferences.icons[editing] || ""} onClose={() => setEditing(null)} onSave={(name, icon) => saveAppearance(editing, name, icon, onRename)} /></Suspense>}
  </>;
}
