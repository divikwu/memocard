import type { ComponentType, ComponentProps } from "react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@ui/lib/utils";

type View = {
  Popover: ComponentType<ComponentProps<typeof import("@ui/components/popover")["Popover"]>>;
  PopoverContent: ComponentType<ComponentProps<typeof import("@ui/components/popover")["PopoverContent"]>>;
  Input: ComponentType<ComponentProps<typeof import("@ui/components/input")["Input"]>>;
  Sheet: ComponentType<ComponentProps<typeof import("@ui/components/sheet")["Sheet"]>>;
  SheetClose: ComponentType<ComponentProps<typeof import("@ui/components/sheet")["SheetCloseButton"]>>;
  SheetContent: ComponentType<ComponentProps<typeof import("@ui/components/sheet")["SheetContent"]>>;
  SheetHeader: ComponentType<ComponentProps<typeof import("@ui/components/sheet")["SheetHeader"]>>;
  SheetTitle: ComponentType<ComponentProps<typeof import("@ui/components/sheet")["SheetTitle"]>>;
};
type SaveName = (name: string) => Promise<void>;
export function createNameEditor(view: View) {
 const {Popover,PopoverContent,Input,Sheet,SheetClose,SheetContent,SheetHeader,SheetTitle} = view;

function NameEditor({ initialName, anchor, title, inputLabel, maxLength, selectOnFocus, busy = false, sheet = false, anchorIsTrigger = false, initialFocus, finalFocus, leading, trailing, children, side, align, sideOffset = 8, className, onClose, onSave }: {
  initialName: string; anchor: HTMLElement; title: string; inputLabel: string;
  maxLength?: number; selectOnFocus?: boolean; busy?: boolean;
  sheet?: boolean;
  anchorIsTrigger?: boolean;
  initialFocus?: () => HTMLElement | null;
  finalFocus?: () => HTMLElement | false;
  side?: "bottom" | "right"; align?: "start" | "end"; sideOffset?: number;
  className?: string;
  leading?: (disabled: boolean) => ReactNode; trailing?: (disabled: boolean) => ReactNode; children?: (disabled: boolean) => ReactNode;
  onClose: () => void; onSave: SaveName;
}) {
  const isMobile = useIsMobile();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const disabled = busy || saving;
  const changed = name.trim() !== initialName;

  useLayoutEffect(() => {
    if (!anchorIsTrigger || sheet) return;
    const toggle = (event: MouseEvent) => {
      event.stopPropagation();
      if (disabled || submitting.current) return;
      if (changed && name.trim()) void saveName();
      else onClose();
    };
    anchor.addEventListener("click", toggle);
    return () => anchor.removeEventListener("click", toggle);
  }, [anchor, anchorIsTrigger, changed, disabled, name, onClose, onSave, sheet]);

  async function runSave(save: () => Promise<void>, onSuccess?: () => void) {
    if (disabled || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError("");
    try { await save(); onSuccess?.(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败，请重试。");
      requestAnimationFrame(() => nameInput.current?.focus({ preventScroll: true }));
    }
    finally { submitting.current = false; setSaving(false); }
  }

  function saveName() {
    if (disabled || submitting.current) return;
    const next = name.trim();
    if (!next) { setError(`请输入${inputLabel}。`); return; }
    if (!changed) { onClose(); return; }
    void runSave(() => onSave(next), onClose);
  }

  function handleOpenChange(open: boolean, details: { reason: string; event: Event; cancel: () => void }) {
    if (open) return;
    if (disabled || submitting.current) { details.cancel(); return; }
    if (anchorIsTrigger && !sheet && (details.reason === "outside-press" || details.reason === "focus-out")) {
      const target = details.reason === "focus-out" ? (details.event as FocusEvent).relatedTarget : details.event.target;
      if (target instanceof Node && anchor.contains(target)) { details.cancel(); return; }
    }
    if (details.reason === "escape-key" || !name.trim() || !changed) {
      onClose();
      return;
    }
    details.cancel();
    void saveName();
  }

  const content = <>
      <form className="space-y-2" onSubmit={event => {
        event.preventDefault();
        void saveName();
      }}>
        <div className="flex items-center gap-x-1">
          {leading?.(disabled)}
          <Input ref={nameInput} className="min-w-0 flex-1 border-0" aria-label={inputLabel} maxLength={maxLength} value={name} onFocus={event => { if (selectOnFocus) event.currentTarget.select(); }} onChange={event => { setName(event.target.value); setError(""); }} onKeyDown={event => { if (event.key === "Enter" && (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)) event.preventDefault(); }} disabled={disabled} />
          {trailing?.(disabled)}
        </div>
        {saving && <p role="status" className="sr-only">保存中…</p>}
        {error && <p role="alert" className="px-1 text-sm text-error">{error}</p>}
      </form>
      {children?.(disabled)}
  </>;
  if (sheet) return <Sheet open onOpenChange={handleOpenChange}>
    <SheetContent side="bottom" className="mobile-tag-menu" initialFocus={() => initialFocus?.() ?? nameInput.current ?? false} finalFocus={finalFocus ?? (() => anchor)} showCloseButton={false} swipeToClose swipeDisabled={disabled}>
      <SheetHeader className="flex-row items-center justify-between p-0"><SheetTitle>{title}</SheetTitle><SheetClose aria-label={`关闭${title}`} disabled={disabled} /></SheetHeader>
      {content}
    </SheetContent>
  </Sheet>;
  return <Popover open onOpenChange={handleOpenChange}>
    <PopoverContent anchor={anchor} side={side ?? (isMobile ? "bottom" : "right")} align={align ?? (isMobile ? "end" : "start")} collisionPadding={12} sideOffset={sideOffset} aria-label={title} className={cn("name-editor-popup w-96 max-w-[calc(100vw-24px)] max-h-(--available-height) overflow-y-auto p-3", className)} initialFocus={() => initialFocus?.() ?? nameInput.current ?? false} finalFocus={finalFocus ?? (() => anchor)}>
      {content}
    </PopoverContent>
  </Popover>;
}

 return NameEditor;
}
