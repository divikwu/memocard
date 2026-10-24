import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Popover } from "@base-ui/react/popover";
import { updateCallout } from "../../src/rich-callout";
import type { CalloutIconTarget } from "../../src/rich-callout-view";
import { EmojiPicker } from "./tag-navigation-editor";
import "./sidebar.css";

export function CalloutIconPicker({ editor, target, onClose }: { editor: Editor; target: CalloutIconTarget; onClose: () => void }) {
  const [error, setError] = useState("");
  useEffect(() => { target.anchor.setAttribute("aria-expanded", "true"); return () => target.anchor.setAttribute("aria-expanded", "false"); }, [target]);
  function apply(icon: string | null) {
    const pos = target.getPos();
    if (!editor.isEditable || !target.anchor.isConnected || pos === undefined || editor.state.doc.nodeAt(pos)?.type.name !== "aside") { setError("标注已变化，请关闭后重新打开。"); return; }
    updateCallout(editor, pos, { icon }); onClose();
  }
  const pos = target.getPos();
  const selected = pos === undefined ? "" : String(editor.state.doc.nodeAt(pos)?.attrs.icon ?? "");
  return <Popover.Root open onOpenChange={open => { if (!open) onClose(); }}><Popover.Portal><Popover.Positioner anchor={target.anchor} align="start" sideOffset={4} collisionPadding={12} className="isolate z-50"><Popover.Popup aria-label="编辑标注图标" className="next-rich-ui callout-icon-picker max-h-[85dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl border border-border bg-popover p-4 text-sm text-primary shadow-lg outline-hidden" initialFocus={false} finalFocus={type => type === "mouse" || type === "touch" ? false : target.anchor.isConnected ? target.anchor : editor.view.dom}>
    <EmojiPicker selected={selected} disabled={!editor.isEditable} autoFocus onSelect={emoji => apply(emoji || null)} />{error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
  </Popover.Popup></Popover.Positioner></Popover.Portal></Popover.Root>;
}
