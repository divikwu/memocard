import { Pin } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

export function NotePinButton({ pinned, disabled, unsaved, onClick }: {
  pinned: boolean; disabled: boolean; unsaved: boolean; onClick: () => void;
}) {
  const label = pinned ? "取消固定" : "固定到主页";
  return <TooltipProvider><Tooltip>
    <TooltipTrigger render={<Button type="button" variant="ghost" size="icon" className="size-8" style={pinned ? {color:"var(--accent-text)"} : undefined} aria-label={label} aria-pressed={pinned} disabled={disabled} onClick={onClick}>
      <Pin className="size-4" fill={pinned ? "currentColor" : "none"} />
    </Button>} />
    <TooltipContent>{unsaved ? "保存笔记后可固定到主页" : label}</TooltipContent>
  </Tooltip></TooltipProvider>;
}
