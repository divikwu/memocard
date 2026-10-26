import { recoverableLazy } from "../components/recoverable-lazy";
import { Suspense, useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import ArrowDown01Icon from "@hugeicons/core-free-icons/ArrowDown01Icon";
import GridViewIcon from "@hugeicons/core-free-icons/GridViewIcon";
import LeftToRightListBulletIcon from "@hugeicons/core-free-icons/LeftToRightListBulletIcon";
import Edit02Icon from "@hugeicons/core-free-icons/Edit02Icon";
import PinIcon from "@hugeicons/core-free-icons/PinIcon";
import PinOffIcon from "@hugeicons/core-free-icons/PinOffIcon";
import { useTagPreferences } from "../../src/hooks/use-tag-preferences";
import { useCollectionLayout } from "../../src/hooks/use-collection-layout";
import { Button } from "../components/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/dropdown-menu";
import "./sidebar.css";

const TagEditor = recoverableLazy(() => import("./tag-navigation-editor").then(module => ({ default: module.TagEditor })), "标签编辑");
export type MobileTagActionsProps = { tag?: string | null; title?: string; home?: boolean; vaultId?: string | null; onRename: (from: string, to: string) => Promise<void> };

export function MobileTagActions({ tag, title, home = false, vaultId, onRename }: MobileTagActionsProps) {
  const { preferences, error, togglePinned, saveAppearance } = useTagPreferences(vaultId);
  const [layout, changeLayout] = useCollectionLayout(home ? "memocard:home-layout" : undefined, home ? "list" : "cards");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const openingEditor = useRef<string | null>(null);
  const titleButton = useRef<HTMLButtonElement>(null);
  const pinned = !!tag && preferences.pinned.includes(tag);
  return <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={<Button ref={titleButton} type="button" variant="ghost" size="sm" className="min-w-0 max-w-full gap-1 pr-1 pl-3 text-base font-medium text-primary" aria-label={tag ? `标签操作 ${tag}` : `视图选项 ${title}`} aria-current="page" />}><span className="truncate">{tag ? `# ${tag}` : title}</span><HugeiconsIcon icon={ArrowDown01Icon} className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" /></DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="center" sideOffset={8} className="next-mobile-tag-menu" finalFocus={() => {
        if (openingEditor.current) { setEditing(openingEditor.current); openingEditor.current = null; return false; }
        return titleButton.current;
      }}>
        <DropdownMenuRadioGroup aria-label="笔记布局" value={layout} onValueChange={next => { if (next === "cards" || next === "list") changeLayout(next); }}>
          <DropdownMenuRadioItem value="cards" closeOnClick><HugeiconsIcon icon={GridViewIcon} strokeWidth={2} aria-hidden="true" />卡片</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="list" closeOnClick><HugeiconsIcon icon={LeftToRightListBulletIcon} strokeWidth={2} aria-hidden="true" />列表</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        {tag && <><DropdownMenuSeparator />
          <DropdownMenuItem closeOnClick={false} disabled={pinning} onClick={async () => { if (pinning) return; setPinning(true); try { if (await togglePinned(tag)) setOpen(false); } finally { setPinning(false); } }}><HugeiconsIcon icon={pinned ? PinOffIcon : PinIcon} strokeWidth={2} aria-hidden="true" />{pinned ? "取消置顶" : "置顶标签"}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { openingEditor.current = tag; }}><HugeiconsIcon icon={Edit02Icon} strokeWidth={2} aria-hidden="true" />编辑名称／图标</DropdownMenuItem>
        </>}
        {error && <p role="alert" className="px-3 py-2 text-sm text-error">{error}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
    {editing && titleButton.current && <Suspense fallback={null}><TagEditor path={editing} anchor={titleButton.current} mobile initialIcon={preferences.icons[editing] || ""} onClose={() => setEditing(null)} onSave={(name, icon) => saveAppearance(editing, name, icon, onRename)} /></Suspense>}
  </>;
}
