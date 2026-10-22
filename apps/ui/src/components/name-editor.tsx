import { useRef, useState, type ReactNode } from "react";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { X } from "lucide-react";

export function NameEditor({ initialName, anchor, title, inputLabel, description, maxLength, selectOnFocus, busy = false, sheet = false, leading, children, side, align, sideOffset = 8, className, onClose, onSave }: {
  initialName: string; anchor: HTMLElement; title: string; inputLabel: string; description?: string;
  maxLength?: number; selectOnFocus?: boolean; busy?: boolean;
  sheet?: boolean;
  side?: "bottom" | "right"; align?: "start" | "end"; sideOffset?: number;
  className?: string;
  leading?: (disabled: boolean) => ReactNode; children?: (disabled: boolean) => ReactNode;
  onClose: () => void; onSave: (name: string) => Promise<void>;
}) {
  const isMobile = useIsMobile();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const disabled = busy || saving;
  const content = <>
      <form className="space-y-2" onSubmit={async event => {
        event.preventDefault();
        if (disabled || submitting.current || !name.trim()) return;
        submitting.current = true; setSaving(true); setError("");
        try { await onSave(name.trim()); onClose(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，请重试。"); }
        finally { submitting.current = false; setSaving(false); }
      }}>
        <div className={`grid ${leading ? "grid-cols-[auto_minmax(0,1fr)_auto]" : "grid-cols-[minmax(0,1fr)_auto]"} items-center gap-2`}>
          {leading?.(disabled)}
          <Input ref={nameInput} aria-label={inputLabel} maxLength={maxLength} value={name} onFocus={event => { if (selectOnFocus) event.currentTarget.select(); }} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }} disabled={disabled} />
          <Button type="submit" className="px-3" disabled={disabled || !name.trim()}>{saving ? "保存中…" : "保存"}</Button>
        </div>
        {description && <p className="px-1 text-pretty text-xs leading-normal text-muted-foreground">{description}</p>}
        {error && <p role="alert" className="px-1 text-sm text-destructive">{error}</p>}
      </form>
      {children?.(disabled)}
  </>;
  if (sheet) return <Sheet open onOpenChange={(open, details) => { if (!open) { if (disabled) details.cancel(); else onClose(); } }}>
    <SheetContent side="bottom" className="mobile-tag-menu" initialFocus={nameInput} finalFocus={() => anchor} showCloseButton={false} swipeToClose swipeDisabled={disabled}>
      <SheetHeader className="flex-row items-center justify-between p-0"><SheetTitle>{title}</SheetTitle><SheetClose render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`关闭${title}`} disabled={disabled} />}><X aria-hidden="true" /></SheetClose></SheetHeader>
      {content}
    </SheetContent>
  </Sheet>;
  return <Popover open onOpenChange={(open, details) => { if (!open) { if (disabled) details.cancel(); else onClose(); } }}>
    <PopoverContent anchor={anchor} side={side ?? (isMobile ? "bottom" : "right")} align={align ?? (isMobile ? "end" : "start")} collisionPadding={12} sideOffset={sideOffset} aria-label={title} className={cn("w-96 max-w-[calc(100vw-24px)] max-h-(--available-height) overflow-y-auto p-3", className)} initialFocus={nameInput} finalFocus={() => anchor}>
      {content}
    </PopoverContent>
  </Popover>;
}
